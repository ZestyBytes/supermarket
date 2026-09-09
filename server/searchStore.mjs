import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

/**
 * What Tesco said about a search, kept between page loads and restarts.
 *
 * The catalogue sweep asks about every ingredient in every dinner so a card
 * can say what a meal costs and whether it can be shopped: 107 searches. In
 * memory only, that bill was paid again on every refresh and again on every
 * restart, which is both slow and the surest way to be told to slow down. The
 * answers barely move; a shelf price is the same at teatime as at breakfast.
 *
 * So it lives on disk. It holds product names, sizes and prices, which is
 * public shelf information: no part of the session is written here, and this
 * file is deliberately not the one the session lives in.
 */
const DEFAULT_PATH = join(homedir(), '.supermarket', 'search-cache.json');

/** Long enough to cover a day's use, short enough that prices stay honest. */
export const KEEP_MS = 6 * 60 * 60 * 1000;

/** Beyond this the file is trimmed, oldest first, so it cannot grow forever. */
const MAX_ENTRIES = 2000;

export function createSearchStore({ path = DEFAULT_PATH, keepMs = KEEP_MS, now = Date.now } = {}) {
  const entries = new Map();
  let loading = null;
  let dirty = false;
  let writing = null;

  /**
   * Read the file once, and make everyone else wait for that read.
   *
   * Searches run four at a time, so the first four all arrive here together.
   * A plain "have I loaded yet" flag is set before the file has been read, so
   * three of those four sail past an empty map and ask Tesco for something
   * already on disk, which is most of the saving gone on exactly the cold
   * start the cache exists for.
   */
  function load() {
    loading ??= (async () => {
      try {
        const saved = JSON.parse(await readFile(path, 'utf8'));
        for (const [key, entry] of Object.entries(saved.entries ?? {})) {
          if (entry?.until > now() && Array.isArray(entry.products)) entries.set(key, entry);
        }
      } catch {
        // No file, or one we cannot read. Starting empty is always correct
        // here; the worst it costs is the searches we would have done anyway.
      }
    })();
    return loading;
  }

  async function flush() {
    if (!dirty) return;
    dirty = false;
    const keep = [...entries.entries()]
      .filter(([, entry]) => entry.until > now())
      .sort((a, b) => b[1].until - a[1].until)
      .slice(0, MAX_ENTRIES);
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify({ entries: Object.fromEntries(keep) }), { mode: 0o600 });
    } catch {
      // A cache that cannot be written is a cache, not a failure.
    }
  }

  return {
    async get(key) {
      await load();
      const entry = entries.get(key);
      if (!entry || entry.until <= now()) return undefined;
      return entry.products;
    },
    async set(key, products) {
      await load();
      entries.set(key, { products, until: now() + keepMs });
      dirty = true;
      // Coalesced, so a sweep of a hundred searches writes the file once.
      writing ??= setTimeout(() => { writing = null; void flush(); }, 1000);
      if (typeof writing?.unref === 'function') writing.unref();
    },
    /** For tests and shutdown: write now rather than in a moment. */
    async flush() {
      if (writing) { clearTimeout(writing); writing = null; }
      await flush();
    },
    size() {
      return entries.size;
    },
  };
}


/**
 * The same shape, remembering nothing beyond this process.
 *
 * The default for anything that has not been handed a real one, so that a test
 * or a one-off script cannot write to, or read from, the cache a person's own
 * app is using. Reaching a real path by default is how a test came to depend
 * on something another test had left in someone's home directory.
 */
export function createMemorySearchStore({ keepMs = KEEP_MS, now = Date.now } = {}) {
  const entries = new Map();
  return {
    async get(key) {
      const entry = entries.get(key);
      return entry && entry.until > now() ? entry.products : undefined;
    },
    async set(key, products) {
      entries.set(key, { products, until: now() + keepMs });
    },
    async flush() {},
    size: () => entries.size,
  };
}
