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
  // A write that reaches Tesco and then throws used to end the whole
  // submission, which is how half a shop went missing. It is now retried,
  // and that is safe precisely because the quantity is absolute: the danger
  // being guarded against is a doubled quantity, not a repeated request.
  it('does not double a quantity when a write applies and then throws', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    let qty = 0; let writes = 0;
    const client = { readBasket: async () => ({ total: 3, items: qty ? [{ id: '123', qty, title: 'Chicken', price: 3 }] : [] }), setQuantity: async (_id, target) => { qty = target; writes++; throw new Error('Connection lost'); } };
    const input = { attemptId: randomUUID(), items: [{ productId: '123', qty: 1 }] };

    expect((await submitBasket(client, input, dir)).verified).toBe(true);
    expect(qty).toBe(1);

    // The receipt still stops a repeated attempt from writing again at all.
    const writesAfterFirst = writes;
    await submitBasket(client, input, dir);
    expect(writes).toBe(writesAfterFirst);
    expect(qty).toBe(1);
  });
  it('keeps going when one product fails, instead of dropping the rest of the shop', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    const held = new Map();
    const client = {
      readBasket: async () => ({ total: 0, items: [...held].map(([id, qty]) => ({ id, qty, title: id, price: 1 })) }),
      setQuantity: async (id, target) => {
        if (id === 'bad') throw Object.assign(new Error('Tesco said no'), { code: 'RETAILER_ERROR' });
        held.set(id, target);
      },
    };
    const items = ['a', 'b', 'bad', 'c', 'd'].map(productId => ({ productId, qty: 1 }));
    const result = await submitBasket(client, { attemptId: randomUUID(), items }, dir);

    expect(result.added.map(a => a.productId)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].productId).toBe('bad');
    expect(result.verified).toBe(false);
  });

  it('retries a flaky line once, which is safe because the quantity is absolute', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    const held = new Map();
    let attempts = 0;
    const client = {
      readBasket: async () => ({ total: 0, items: [...held].map(([id, qty]) => ({ id, qty, title: id, price: 1 })) }),
      setQuantity: async (id, target) => {
        if (id === 'flaky' && attempts++ === 0) throw Object.assign(new Error('blip'), { code: 'RETAILER_ERROR' });
        held.set(id, target);
      },
    };
    const result = await submitBasket(client, { attemptId: randomUUID(), items: [{ productId: 'flaky', qty: 2 }] }, dir);
    expect(result.verified).toBe(true);
    expect(held.get('flaky')).toBe(2);
  });

  it('stops early when Tesco signs you out, and says which lines never went', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    const held = new Map();
    const client = {
      readBasket: async () => ({ total: 0, items: [...held].map(([id, qty]) => ({ id, qty, title: id, price: 1 })) }),
      setQuantity: async (id, target) => {
        if (id === 'c') throw Object.assign(new Error('gone'), { code: 'SESSION_EXPIRED' });
        held.set(id, target);
      },
    };
    const items = ['a', 'b', 'c', 'd'].map(productId => ({ productId, qty: 1 }));
    const result = await submitBasket(client, { attemptId: randomUUID(), items }, dir);

    expect(result.added.map(a => a.productId)).toEqual(['a', 'b']);
    expect(result.failed.map(f => f.productId)).toEqual(['c', 'd']);
    expect(result.failed[0].error.code).toBe('SESSION_EXPIRED');
  });

  it('rejects invalid quantities before touching a basket', async () => {
    await expect(submitBasket({}, { attemptId: randomUUID(), items: [{ productId: '123', qty: -1 }] })).rejects.toThrow();
  });

  // "Tesco asked us to slow down" was treated exactly like a dead session:
  // the shop stopped dead and the person was handed a button to press. It is
  // the opposite kind of failure. Waiting is what it is asking for.
  it('waits out a rate limit and gets the line in', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    const slept = [];
    const held = new Map();
    let refusals = 2;
    const client = {
      readBasket: async () => ({ total: 0, items: [...held].map(([id, qty]) => ({ id, qty, title: id, price: 1 })) }),
      setQuantity: async (id, qty) => {
        if (refusals > 0) { refusals -= 1; throw Object.assign(new Error('slow down'), { code: 'RATE_LIMITED' }); }
        held.set(id, qty);
      },
    };
    const input = { attemptId: randomUUID(), items: [{ productId: 'a', qty: 1 }] };

    const result = await submitBasket(client, input, dir, async (ms) => { slept.push(ms); });

    expect(result.verified).toBe(true);
    expect(held.get('a')).toBe(1);
    // Backed off further each time rather than hammering.
    expect(slept.filter((ms) => ms >= 1000)).toEqual([1000, 3000]);
  });

  it('gives up on a line Tesco keeps throttling, and still shops the rest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    const held = new Map();
    const client = {
      readBasket: async () => ({ total: 0, items: [...held].map(([id, qty]) => ({ id, qty, title: id, price: 1 })) }),
      setQuantity: async (id, qty) => {
        if (id === 'a') throw Object.assign(new Error('slow down'), { code: 'RATE_LIMITED' });
        held.set(id, qty);
      },
    };
    const input = { attemptId: randomUUID(), items: [{ productId: 'a', qty: 1 }, { productId: 'b', qty: 2 }] };

    const result = await submitBasket(client, input, dir, async () => {});

    // The throttled line is reported, and the rest of the week still arrives.
    expect(result.failed.map((f) => f.productId)).toEqual(['a']);
    expect(result.failed[0].error.code).toBe('RATE_LIMITED');
    expect(held.get('b')).toBe(2);
  });

  it('slows the remaining lines down once it has been throttled once', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    const slept = [];
    const held = new Map();
    let first = true;
    const client = {
      readBasket: async () => ({ total: 0, items: [...held].map(([id, qty]) => ({ id, qty, title: id, price: 1 })) }),
      setQuantity: async (id, qty) => {
        if (first) { first = false; throw Object.assign(new Error('slow down'), { code: 'RATE_LIMITED' }); }
        held.set(id, qty);
      },
    };
    const input = { attemptId: randomUUID(), items: [{ productId: 'a', qty: 1 }, { productId: 'b', qty: 1 }] };

    await submitBasket(client, input, dir, async (ms) => { slept.push(ms); });

    // Going back to full speed straight after a refusal earns the next one.
    expect(slept).toContain(700);
    expect(held.get('b')).toBe(1);
  });

  it('waits out a throttled basket read instead of failing before it starts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-submission-'));
    const held = new Map();
    let refusals = 2;
    const client = {
      readBasket: async () => {
        if (refusals > 0) { refusals -= 1; throw Object.assign(new Error('slow down'), { code: 'RATE_LIMITED' }); }
        return { total: 0, items: [...held].map(([id, qty]) => ({ id, qty, title: id, price: 1 })) };
      },
      setQuantity: async (id, qty) => { held.set(id, qty); },
    };
    const input = { attemptId: randomUUID(), items: [{ productId: 'a', qty: 1 }] };

    const result = await submitBasket(client, input, dir, async () => {});

    expect(result.verified).toBe(true);
    expect(held.get('a')).toBe(1);
  });
});
