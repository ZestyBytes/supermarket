import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { removeFromBasket } from '../basket.mjs';

/** A basket that behaves like Tesco's: removal is absolute, so it is idempotent. */
function shop(start = { a: 1, b: 2, c: 1 }, { refuse } = {}) {
  const held = new Map(Object.entries(start));
  return {
    held,
    client: {
      readBasket: async () => ({
        total: [...held.values()].reduce((n, q) => n + q, 0),
        items: [...held].map(([id, qty]) => ({ id, qty, title: id, price: 1 })),
      }),
      removeItem: async (id) => {
        if (refuse?.(id)) throw Object.assign(new Error('no'), { code: 'RETAILER_ERROR' });
        held.delete(id);
      },
    },
  };
}

describe('taking things out of the basket', () => {
  it('removes only the lines it was given', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-removal-'));
    const { client, held } = shop();

    const result = await removeFromBasket(client, { attemptId: randomUUID(), productIds: ['a', 'c'] }, dir, async () => {});

    expect(result.verified).toBe(true);
    expect([...held.keys()]).toEqual(['b']);
    expect(result.removed.map((r) => r.productId)).toEqual(['a', 'c']);
  });

  it('empties the whole basket when given no ids', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-removal-'));
    const { client, held } = shop();

    const result = await removeFromBasket(client, { attemptId: randomUUID() }, dir, async () => {});

    expect(held.size).toBe(0);
    expect(result.verified).toBe(true);
    expect(result.basket.items).toEqual([]);
  });

  it('ignores what is not there rather than asking Tesco to remove it twice', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-removal-'));
    const asked = [];
    const { client, held } = shop({ a: 1 });
    const watched = { ...client, removeItem: async (id) => { asked.push(id); held.delete(id); } };

    const result = await removeFromBasket(watched, { attemptId: randomUUID(), productIds: ['a', 'ghost'] }, dir, async () => {});

    expect(asked).toEqual(['a']);
    expect(result.verified).toBe(true);
  });

  it('is safe to repeat, because gone twice is still gone', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-removal-'));
    const { client, held } = shop({ a: 1, b: 1 });
    const input = { attemptId: randomUUID(), productIds: ['a'] };

    await removeFromBasket(client, input, dir, async () => {});
    const second = await removeFromBasket(client, { ...input, attemptId: randomUUID() }, dir, async () => {});

    expect([...held.keys()]).toEqual(['b']);
    expect(second.verified).toBe(true);
  });

  it('keeps going when one line will not go, and says which', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-removal-'));
    const { client, held } = shop({ a: 1, b: 1, c: 1 }, { refuse: (id) => id === 'b' });

    const result = await removeFromBasket(client, { attemptId: randomUUID() }, dir, async () => {});

    expect([...held.keys()]).toEqual(['b']);
    expect(result.verified).toBe(false);
    expect(result.failed.map((f) => f.productId)).toEqual(['b']);
    expect(result.removed.map((r) => r.productId)).toEqual(['a', 'c']);
  });

  it('waits out a throttle rather than leaving the basket half emptied', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-removal-'));
    const slept = [];
    const { client, held } = shop({ a: 1, b: 1 });
    let refusals = 2;
    const throttling = {
      ...client,
      removeItem: async (id) => {
        if (refusals > 0) { refusals -= 1; throw Object.assign(new Error('slow'), { code: 'RATE_LIMITED' }); }
        held.delete(id);
      },
    };

    const result = await removeFromBasket(throttling, { attemptId: randomUUID() }, dir, async (ms) => { slept.push(ms); });

    expect(held.size).toBe(0);
    expect(result.verified).toBe(true);
    expect(slept.filter((ms) => ms >= 1000)).toEqual([1000, 3000]);
  });

  it('does nothing to an empty basket', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-removal-'));
    const { client } = shop({});

    const result = await removeFromBasket(client, { attemptId: randomUUID() }, dir, async () => {});

    expect(result.removed).toEqual([]);
    expect(result.verified).toBe(true);
  });

  it('refuses an id that is not shaped like a product id', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'supermarket-removal-'));
    const { client } = shop();
    await expect(
      removeFromBasket(client, { attemptId: randomUUID(), productIds: ['../../etc/passwd'] }, dir, async () => {}),
    ).rejects.toThrow();
  });
});
