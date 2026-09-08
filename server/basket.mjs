import { mkdir, open, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { retailerError } from './adapters/open-supermarkets.mjs';
export const submissionSchema = z.object({ attemptId: z.string().uuid(), items: z.array(z.object({ productId: z.string().regex(/^[a-zA-Z0-9-]+$/).max(100), qty: z.number().int().min(1).max(99) })).min(1).max(60) });

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
    for (const item of targets) {
      try { await client.setQuantity(item.productId, item.qty); }
      catch { break; } // Do not repeat an uncertain write or continue an expired session.
    }
    const basket = await client.readBasket().catch(() => null);
    if (!basket) throw retailerError('BASKET_UNCERTAIN', 'The update could not be verified. Check Tesco; this attempt will not be repeated.');
    const added = targets.filter(t => basket.items.find(i => i.id === t.productId)?.qty === t.qty);
    const failed = targets.filter(t => !added.includes(t)).map(t => ({ ...t, error: { code: 'BASKET_UNCERTAIN', message: 'Quantity not verified at Tesco.' } }));
    const result = { ok: true, added, failed, basket, verified: failed.length === 0 };
    await writeFile(receiptPath, JSON.stringify({ result }), { mode: 0o600 });
    return result;
  } finally { await lock.close(); await unlink(lockPath); }
}
