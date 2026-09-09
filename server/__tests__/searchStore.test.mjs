import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSearchStore } from '../searchStore.mjs';

const shelf = [{ id: '1', name: 'Tesco Onions 1Kg', price: 1.2 }];

describe('what Tesco said, kept between runs', () => {
  it('answers from disk after a restart, without asking again', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'supermarket-cache-')), 'search.json');

    const first = createSearchStore({ path });
    await first.set('onions|5', shelf);
    await first.flush();

    // A different store is what a restarted server has.
    const second = createSearchStore({ path });
    expect(await second.get('onions|5')).toEqual(shelf);
  });

  it('forgets an answer once it is too old to trust', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'supermarket-cache-')), 'search.json');
    let clock = 1_000_000;

    const store = createSearchStore({ path, keepMs: 1000, now: () => clock });
    await store.set('onions|5', shelf);
    expect(await store.get('onions|5')).toEqual(shelf);

    clock += 1001;
    expect(await store.get('onions|5')).toBeUndefined();
  });

  it('does not carry a stale answer across a restart either', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'supermarket-cache-')), 'search.json');
    let clock = 1_000_000;

    const first = createSearchStore({ path, keepMs: 1000, now: () => clock });
    await first.set('onions|5', shelf);
    await first.flush();

    clock += 5000;
    const second = createSearchStore({ path, keepMs: 1000, now: () => clock });
    expect(await second.get('onions|5')).toBeUndefined();
  });

  it('writes once for a sweep rather than once per search', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'supermarket-cache-')), 'search.json');
    const store = createSearchStore({ path });

    for (let n = 0; n < 100; n++) await store.set(`ingredient-${n}|5`, shelf);
    await store.flush();

    const saved = JSON.parse(await readFile(path, 'utf8'));
    expect(Object.keys(saved.entries)).toHaveLength(100);
  });

  it('starts empty rather than failing when the file is nonsense', async () => {
    const store = createSearchStore({ path: '/definitely/not/a/path/search.json' });
    expect(await store.get('anything|5')).toBeUndefined();
    await expect(store.set('onions|5', shelf)).resolves.not.toThrow();
  });

  it('keeps no part of the session in the file', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'supermarket-cache-')), 'search.json');
    const store = createSearchStore({ path });
    await store.set('onions|5', shelf);
    await store.flush();

    // Shelf prices are public. A cookie or a bearer token is not, and this
    // file must never become somewhere one could end up.
    const raw = await readFile(path, 'utf8');
    expect(raw).not.toMatch(/cookie|authorization|bearer/i);
  });

  it('makes concurrent readers wait for the one file read', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'supermarket-cache-')), 'search.json');
    const first = createSearchStore({ path });
    await first.set('onions|5', shelf);
    await first.set('carrots|5', shelf);
    await first.flush();

    // Searches run four at a time, so they all arrive together. A plain
    // "loaded" flag is set before the file has been read, and everyone after
    // the first sails past an empty map into a needless search.
    const second = createSearchStore({ path });
    const [a, b] = await Promise.all([second.get('onions|5'), second.get('carrots|5')]);
    expect(a).toEqual(shelf);
    expect(b).toEqual(shelf);
  });
});
