import { mkdir, open, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { retailerError } from './adapters/open-supermarkets.mjs';
export const submissionSchema = z.object({ attemptId: z.string().uuid(), items: z.array(z.object({ productId: z.string().regex(/^[a-zA-Z0-9-]+$/).max(100), qty: z.number().int().min(1).max(99) })).min(1).max(60) });

const FATAL = ['SESSION_EXPIRED', 'SESSION_MISSING', 'RATE_LIMITED'];

/** Failures that will not go away on the next product, so stop rather than thrash. */
function fatal(error) { return error != null && FATAL.includes(error.code); }

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Why one line did not go in, in words the app can show. */
function describe(error) {
  if (!error) return { code: 'BASKET_UNCERTAIN', message: 'Tesco did not confirm this line. Check your basket.' };
  if (error.code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED', message: 'Tesco signed you out part-way through.' };
  if (error.code === 'RATE_LIMITED') return { code: 'RATE_LIMITED', message: 'Tesco asked us to slow down before this line.' };
  return { code: error.code ?? 'RETAILER_ERROR', message: 'Tesco refused this line.' };
}

export async function submitBasket(client, input, directory = join(homedir(), '.supermarket', 'attempts')) {
  const { attemptId, items } = submissionSchema.parse(input);
  const combined = new Map();
  for (const item of items) combined.set(item.productId, (combined.get(item.productId) ?? 0) + item.qty);
  await mkdir(directory, { recursive: true });
  const lockPath = join(directory, 'write.lock');
  const lock = await open(lockPath, 'wx').catch(() => { throw retailerError('BASKET_UNCERTAIN', 'Another basket attempt is running or needs checking. Inspect Tesco before retrying.'); });
  const receiptPath = join(directory, `${attemptId}.json`);
  try {
    const existing = await readFile(receiptPath, 'utf8').catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (existing) {
      const record = JSON.parse(existing);
      if (record.result) return record.result;
      throw retailerError('BASKET_UNCERTAIN', 'This attempt may already have changed Tesco. It will not be repeated. Read your basket.');
    }
    const before = await client.readBasket();
    const targets = [...combined].map(([productId, qty]) => ({ productId, qty: qty + (before.items.find(i => i.id === productId)?.qty ?? 0) }));
    if (targets.some(i => i.qty > 99)) throw retailerError('BAD_REQUEST', 'A product would exceed 99 packs.');
    await writeFile(receiptPath, JSON.stringify({ targets }), { flag: 'wx', mode: 0o600 });
    // One product failing is not a reason to abandon the rest of the shop.
    // Losing half a week's ingredients silently is far worse than a line that
    // did not go in, because you only find out when you come to cook.
    //
    // Retrying is safe here in a way it usually is not: Tesco's add sets an
    // ABSOLUTE quantity, so writing "3" twice leaves 3, not 6.
    const reasons = new Map();
    for (const item of targets) {
      let last;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await client.setQuantity(item.productId, item.qty); last = null; break; }
        catch (error) { last = error; if (attempt === 0 && !fatal(error)) await pause(400); }
        if (fatal(last)) break;
      }
      if (last) {
        reasons.set(item.productId, last);
        // A dead session or a rate limit will not recover on the next product,
        // and hammering through the rest only makes it worse.
        if (fatal(last)) break;
      }
    }

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
    return result;
  } finally { await lock.close(); await unlink(lockPath); }
}
