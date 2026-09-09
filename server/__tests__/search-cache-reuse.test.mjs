import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOpenSupermarketsAdapter } from '../adapters/open-supermarkets.mjs';
import { createSearchStore } from '../searchStore.mjs';

function shelf(query) {
  return [{
    product_uid: `uid-${query}`, id: query, name: `Tesco ${query} 1Kg`,
    in_stock: true, retail_price: { price: 1.5 }, price: 1.5,
  }];
}

describe('the catalogue sweep, paid for once', () => {
  it('does not ask Tesco again for something it already asked about', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'supermarket-reuse-')), 'search.json');
    const asked = [];
    const provider = () => ({ search: async (query) => { asked.push(query); return shelf(query); } });
    const session = () => ({ cookie: 'not-a-real-session', apiHeaders: {} });

    const firstStore = createSearchStore({ path });
    const first = createOpenSupermarketsAdapter({
      getSession: session, createProvider: provider, searchCache: firstStore,
    });
    await first.searchBatch(['onions', 'carrots']);
    // Writing is coalesced so a sweep costs one write, not a hundred. Nothing
    // waits for it in life; the test has to.
    await firstStore.flush();
    // Sorted: the batch runs concurrently, so the order it asks in is not the point.
    expect([...asked].sort()).toEqual(['carrots', 'onions']);

    // A second server, as a restart or a refreshed page produces. The sweep is
    // a hundred-odd searches; paying that bill every time is both the wait and
    // the reason Tesco starts refusing.
    const second = createOpenSupermarketsAdapter({
      getSession: session, createProvider: provider, searchCache: createSearchStore({ path }),
    });
    await second.searchBatch(['onions', 'carrots']);
    expect([...asked].sort()).toEqual(['carrots', 'onions']);
  });

  it('still asks about something it has not seen', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'supermarket-reuse-')), 'search.json');
    const asked = [];
    const provider = () => ({ search: async (query) => { asked.push(query); return shelf(query); } });
    const session = () => ({ cookie: 'not-a-real-session', apiHeaders: {} });
    const store = createSearchStore({ path });

    const adapter = createOpenSupermarketsAdapter({ getSession: session, createProvider: provider, searchCache: store });
    await adapter.searchBatch(['onions']);
    await adapter.searchBatch(['onions', 'parsnips']);

    expect([...asked].sort()).toEqual(['onions', 'parsnips']);
  });
});
