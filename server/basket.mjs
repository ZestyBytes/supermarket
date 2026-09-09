import { mkdir, open, readdir, readFile, stat, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { retailerError } from './adapters/open-supermarkets.mjs';
export const removalSchema = z.object({
  attemptId: z.string().uuid(),
  // Absent means everything currently in the basket, which is the one action
  // that can take away shopping this app did not put there.
  productIds: z.array(z.string().regex(/^[a-zA-Z0-9-]+$/).max(100)).max(200).optional(),
});
export const submissionSchema = z.object({ attemptId: z.string().uuid(),
  /**
   * Whether the quantities are what to ADD, or what the basket should END UP
   * holding. Adding on top is right for a person pressing a button once;
   * keeping the basket in step with a plan needs to be able to say "two", not
   * "two more", or every edit compounds the last one.
   */
  absolute: z.boolean().optional(), items: z.array(z.object({ productId: z.string().regex(/^[a-zA-Z0-9-]+$/).max(100), qty: z.number().int().min(1).max(99) })).min(1).max(60) });

// Being signed out does not improve on the next product. Being told to slow
// down does, which is the whole difference: one is a refusal, the other is an
// instruction, and the instruction is "wait", not "give up and ask the user to
// press a button".
const FATAL = ['SESSION_EXPIRED', 'SESSION_MISSING'];

/** Failures that will not go away on the next product, so stop rather than thrash. */
function fatal(error) { return error != null && FATAL.includes(error.code); }

function rateLimited(error) { return error?.code === 'RATE_LIMITED' || error?.status === 429; }

/** Waits between goes at a line Tesco is throttling. */
const RATE_WAITS = [1000, 3000, 8000];
/** Total time the whole shop may spend waiting out throttling before giving up. */
const RATE_BUDGET_MS = 45000;

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Throw away receipts older than this.
 *
 * A receipt exists to stop one attempt being replayed, which matters for
 * minutes, not for ever. They were harmless while a shop was a button someone
 * pressed once a week; now that the basket keeps itself in step there is a
 * file per change, and a folder that only grows is a slow leak with a
 * respectable excuse.
 */
const RECEIPT_KEEP_MS = 24 * 60 * 60 * 1000;

async function forgetOldReceipts(directory) {
  try {
    const names = await readdir(directory);
    await Promise.all(names.filter(name => name.endsWith('.json')).map(async name => {
      const path = join(directory, name);
      const age = await stat(path).then(s => Date.now() - s.mtimeMs).catch(() => 0);
      if (age > RECEIPT_KEEP_MS) await unlink(path).catch(() => {});
    }));
  } catch {
    // Housekeeping. Never a reason to fail a shop.
  }
}

/** A lock older than this was left by something that is no longer running. */
const LOCK_STALE_MS = 120000;

/**
 * One writer at a time, without wedging forever when a writer dies.
 *
 * The lock exists so two writes cannot interleave and leave a basket nobody
 * can explain. But it was only ever removed in a finally block, so a process
 * killed mid-write, which is exactly what a supervisor restarting the app
 * does, left the file behind and every basket write from then on failed with
 * "another attempt is running". Nothing was running. There was a file.
 *
 * So a lock that is older than any real attempt could be is taken over. It
 * records who holds it and since when, which is what makes that judgement
 * something better than a guess.
 */
async function takeLock(lockPath) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const lock = await open(lockPath, 'wx');
      await lock.write(JSON.stringify({ pid: process.pid, since: new Date().toISOString() }));
      return lock;
    } catch (error) {
      if (error.code !== 'EEXIST' || attempt > 0) break;
      const age = await stat(lockPath).then(s => Date.now() - s.mtimeMs).catch(() => 0);
      if (age < LOCK_STALE_MS) break;
      await unlink(lockPath).catch(() => {});
    }
  }
  throw retailerError('BASKET_UNCERTAIN', 'Another basket update is already running. It will finish on its own.');
}


/**
 * Do one thing to each line, patiently, and report what would not go.
 *
 * Shared by adding and removing so that taking something out of a basket has
 * exactly the manners putting it in does: one failure never abandons the rest,
 * a throttle is waited out rather than surrendered to, and being signed out
 * stops the run because nothing after it could work either.
 */
async function eachLine(items, write, sleep) {
  const reasons = new Map();
  let spentWaiting = 0;
  // Once Tesco has asked us to slow down, keep the gap for everything after
  // it too. Going straight back to full speed on the next line is what earns
  // the next refusal.
  let gap = 0;

  for (const item of items) {
    let last;
    let throttled = 0;
    let flaky = 0;

    for (;;) {
      if (gap > 0) await sleep(gap);
      try { await write(item); last = null; break; }
      catch (error) { last = error; }

      if (fatal(last)) break;

      if (rateLimited(last)) {
        const wait = RATE_WAITS[Math.min(throttled, RATE_WAITS.length - 1)];
        // Waiting is the right answer, but not forever: a shop that sits
        // there for minutes is its own kind of broken.
        if (throttled >= RATE_WAITS.length || spentWaiting + wait > RATE_BUDGET_MS) break;
        throttled += 1;
        spentWaiting += wait;
        gap = Math.max(gap, 700);
        await sleep(wait);
        continue;
      }

      if (flaky > 0) break;
      flaky += 1;
      await sleep(400);
    }

    if (last) {
      reasons.set(item.productId, last);
      // A dead session will not recover on the next product, and hammering
      // through the rest only makes it worse.
      if (fatal(last)) break;
    }
  }

  return reasons;
}

/**
 * Do it, waiting out anything Tesco throttles, for reads only.
 *
 * Safe here precisely because nothing has been written yet: repeating a read
 * costs a pause and changes nothing.
 */
async function patiently(read, sleep) {
  let last;
  for (let attempt = 0; attempt <= RATE_WAITS.length; attempt++) {
    try { return await read(); }
    catch (error) {
      last = error;
      if (!rateLimited(error) || attempt === RATE_WAITS.length) throw error;
      await sleep(RATE_WAITS[attempt]);
    }
  }
  throw last;
}

/** Why one line did not go in, in words the app can show. */
function describe(error) {
  if (!error) return { code: 'BASKET_UNCERTAIN', message: 'Tesco did not confirm this line. Check your basket.' };
  if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED', message: 'Tesco signed you out part-way through.' };
  if (error.code === 'RATE_LIMITED' || error.status === 429) return { code: 'RATE_LIMITED', message: 'Tesco kept asking us to slow down, so this line was left out. Try it again in a minute.' };
  return { code: error.code ?? 'RETAILER_ERROR', message: 'Tesco refused this line.' };
}

export async function submitBasket(client, input, directory = join(homedir(), '.supermarket', 'attempts'), sleep = pause) {
  const { attemptId, items, absolute } = submissionSchema.parse(input);
  const combined = new Map();
  for (const item of items) combined.set(item.productId, (combined.get(item.productId) ?? 0) + item.qty);
  await mkdir(directory, { recursive: true });
  const lockPath = join(directory, 'write.lock');
  const lock = await takeLock(lockPath);
  const receiptPath = join(directory, `${attemptId}.json`);
  try {
    const existing = await readFile(receiptPath, 'utf8').catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (existing) {
      const record = JSON.parse(existing);
      if (record.result) return record.result;
      throw retailerError('BASKET_UNCERTAIN', 'This attempt may already have changed Tesco. It will not be repeated. Read your basket.');
    }
    // A read, before any write, so waiting one out is entirely safe. The
    // submission is deliberately not retried by the queue, which meant a
    // throttled first read failed the whole shop before it began.
    const before = await patiently(() => client.readBasket(), sleep);
    const targets = [...combined].map(([productId, qty]) => ({ productId, qty: absolute ? qty : qty + (before.items.find(i => i.id === productId)?.qty ?? 0) }));
    if (targets.some(i => i.qty > 99)) throw retailerError('BAD_REQUEST', 'A product would exceed 99 packs.');
    await writeFile(receiptPath, JSON.stringify({ targets }), { flag: 'wx', mode: 0o600 });
    // One product failing is not a reason to abandon the rest of the shop.
    // Losing half a week's ingredients silently is far worse than a line that
    // did not go in, because you only find out when you come to cook.
    //
    // Retrying is safe here in a way it usually is not: Tesco's add sets an
    // ABSOLUTE quantity, so writing "3" twice leaves 3, not 6.
    const reasons = await eachLine(targets, item => client.setQuantity(item.productId, item.qty), sleep);
    const basket = await client.readBasket().catch(() => null);
    if (!basket) throw retailerError('BASKET_UNCERTAIN', 'The update could not be verified. Check Tesco; this attempt will not be repeated.');
    const added = targets.filter(t => basket.items.find(i => i.id === t.productId)?.qty === t.qty);
    const failed = targets.filter(t => !added.includes(t)).map(t => ({
      ...t,
      inBasket: basket.items.find(i => i.id === t.productId)?.qty ?? 0,
      error: describe(reasons.get(t.productId)),
    }));
    const result = { ok: true, added, failed, basket, verified: failed.length === 0 };
    await writeFile(receiptPath, JSON.stringify({ result }), { mode: 0o600 });
    await forgetOldReceipts(directory);
    return result;
  } finally { await lock.close(); await unlink(lockPath); }
}


/**
 * Take things out of the basket.
 *
 * Removal is the same Tesco mutation as adding with a quantity of zero, so it
 * inherits the property that makes retrying safe: writing "gone" twice leaves
 * it gone. That is why this can be as stubborn as the add path without any
 * risk of taking away more than was asked for.
 *
 * With no ids it empties the basket, which is the only operation here that
 * touches lines this app did not add. The caller is responsible for having
 * asked first; this is the part that does as it is told.
 */
export async function removeFromBasket(client, input, directory = join(homedir(), '.supermarket', 'attempts'), sleep = pause) {
  const { attemptId, productIds } = removalSchema.parse(input);
  await mkdir(directory, { recursive: true });
  const lockPath = join(directory, 'write.lock');
  const lock = await takeLock(lockPath);

  try {
    const before = await patiently(() => client.readBasket(), sleep);
    const held = new Set(before.items.map(item => item.id));
    // Only what is actually there. Asking Tesco to remove something already
    // gone is a request that can only fail, and a failure we would then have
    // to explain.
    const targets = (productIds ?? [...held]).filter(id => held.has(id)).map(productId => ({ productId }));

    if (targets.length === 0) {
      return { ok: true, removed: [], failed: [], basket: before, verified: true };
    }

    const reasons = await eachLine(targets, item => client.removeItem(item.productId), sleep);

    const basket = await client.readBasket().catch(() => null);
    if (!basket) throw retailerError('BASKET_UNCERTAIN', 'The removal could not be verified. Check Tesco; this attempt will not be repeated.');

    const still = new Set(basket.items.map(item => item.id));
    const removed = targets.filter(t => !still.has(t.productId));
    const failed = targets.filter(t => still.has(t.productId)).map(t => ({
      ...t,
      inBasket: basket.items.find(i => i.id === t.productId)?.qty ?? 0,
      error: describe(reasons.get(t.productId)),
    }));

    return { ok: true, removed, failed, basket, verified: failed.length === 0 };
  } finally { await lock.close(); await unlink(lockPath); }
}
