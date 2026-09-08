import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { submitBasket } from '../basket.mjs';
describe('verified basket submission', () => {
  it('adds to existing quantities and deduplicates a repeated attempt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    let qty = 2; let writes = 0;
    const client = { readBasket: async () => ({ total: 10, items: [{ id: '123', qty, title: 'Chicken', price: 3 }, { id: '456', qty: 1, title: 'Milk', price: 1 }] }), setQuantity: async (id, target) => { expect(id).toBe('123'); qty = target; writes++; } };
    const input = { attemptId: randomUUID(), items: [{ productId: '123', qty: 1 }] };
    const result = await submitBasket(client, input, dir);
    expect(qty).toBe(3); expect(result.verified).toBe(true); expect(result.basket.items[1].qty).toBe(1);
    await submitBasket(client, input, dir); expect(writes).toBe(1);
  });
  it('never retries a write that throws after applying', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    let qty = 0; let writes = 0;
    const client = { readBasket: async () => ({ total: 3, items: qty ? [{ id: '123', qty, title: 'Chicken', price: 3 }] : [] }), setQuantity: async (_id, target) => { qty = target; writes++; throw new Error('Connection lost'); } };
    const input = { attemptId: randomUUID(), items: [{ productId: '123', qty: 1 }] };
    expect((await submitBasket(client, input, dir)).verified).toBe(true);
    await submitBasket(client, input, dir); expect(writes).toBe(1);
  });
  it('rejects invalid quantities before touching a basket', async () => {
    await expect(submitBasket({}, { attemptId: randomUUID(), items: [{ productId: '123', qty: -1 }] })).rejects.toThrow();
  });
});
