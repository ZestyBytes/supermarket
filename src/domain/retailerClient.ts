import type { RetailerProduct } from "./liveMatch";
import {createSearchCache} from './searchCache';
import type { Transport } from "./tescoDirect";

/**
 * Talks to the local server, which is the only thing that holds the session.
 *
 * Every failure the server can report has a code, because the app must tell
 * "you are signed out" apart from "nothing found", so showing an empty
 * catalogue when the real answer is an expired session is what sends someone
 * hunting for a bug that is not there.
 */
export type RetailerErrorCode =
  | "SESSION_MISSING"
  | "SESSION_EXPIRED"
  | "NOT_CONFIGURED"
  | "UNSAFE_CONFIG"
  | "RATE_LIMITED"
  | "RETAILER_ERROR"
  | "BAD_REQUEST"
  | "NETWORK"
  | "OFFLINE";

export class RetailerError extends Error {
  code: RetailerErrorCode;
  constructor(code: RetailerErrorCode, message: string) {
    super(message);
    this.name = "RetailerError";
    this.code = code;
  }
}

export interface SessionState {
  present: boolean;
  retailer?: string;
  importedAt?: string;
  cookieCount?: number;
  ageHours?: number;
}

export interface RetailerBasket {
  items: Array<{ id: string; title: string; qty: number; price: number }>;
  /** The retailer's own total. Authoritative, because it knows about delivery and offers. */
  total: number;
}

const BASE = "/api";

/**
 * Whether the page is open on the same machine as the server.
 *
 * Only used to word a failure, never to decide one. A phone on the sofa
 * reaching the dev server across the house is not a loopback page, but the
 * `/api` proxy still lands on a real local server, so deciding from the
 * hostname would refuse exactly the setup that works. Ask the server instead.
 */
export function isLoopbackPage(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

/**
 * Where Tesco is reached, decided once at start-up.
 *
 * Inside the extension the app calls Tesco itself and there is no server to
 * run. Anywhere else it asks the local one, exactly as before. Everything
 * above this line is the same code either way: consolidating a week, matching
 * packs, working out the difference between a list and a basket. None of that
 * cares which side of the wire it is on.
 */
let direct: Transport | undefined;

export function useDirectTesco(transport: Transport | undefined) {
  direct = transport;
}

export function talkingDirect(): boolean {
  return direct !== undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new RetailerError("OFFLINE", "The local server is not running. Start it with: npm run server");
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok: boolean; error?: { code: RetailerErrorCode; message: string } }
    | null;

  if (!response.ok || !payload?.ok) {
    // No JSON body at all means nothing that speaks our protocol answered:
    // a static host serving its own 404 page, not a retailer refusing us.
    if (!payload) {
      throw new RetailerError(
        "OFFLINE",
        isLoopbackPage()
          ? "The local server is not running. Start it with: npm run server"
          : "Nothing answered at /api. If this is a hosted copy there is no local server to reach; if you are on a phone, check that the computer running the app is on the same network and has npm run server going.",
      );
    }
    const error = payload.error;
    throw new RetailerError(error?.code ?? "RETAILER_ERROR", error?.message ?? `Request failed (${response.status}).`);
  }
  return payload as T;
}

export async function getSession(): Promise<{ session: SessionState; mode: "live" | "mock" }> {
  // In the extension there is nothing to be connected to: the browser either
  // has a Tesco session or it does not, and asking it costs one basket read.
  if (direct) {
    try {
      await direct.readBasket();
      return { session: { present: true }, mode: "live" };
    } catch (error) {
      const code = (error as { code?: RetailerErrorCode }).code;
      if (code === "SESSION_MISSING" || code === "SESSION_EXPIRED") return { session: { present: false }, mode: "live" };
      throw asRetailerError(error);
    }
  }
  return request("/session");
}

export async function search(query: string, limit = 8): Promise<RetailerProduct[]> {
  const { results } = await request<{ results: RetailerProduct[] }>(
    `/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  return results;
}

export async function readBasket(): Promise<RetailerBasket> {
  if (direct) return direct.readBasket().catch((error) => { throw asRetailerError(error); });
  const { basket } = await request<{ basket: RetailerBasket }>("/basket");
  return basket;
}

async function fetchSearchBatch(queries: string[]): Promise<Array<{ query: string; results: RetailerProduct[]; error?: { code: RetailerErrorCode; message: string } }>> {
  if (direct) {
    return direct
      .searchBatch(queries)
      .catch((error) => { throw asRetailerError(error); }) as Promise<Array<{ query: string; results: RetailerProduct[]; error?: { code: RetailerErrorCode; message: string } }>>;
  }
  const result = await request<{ results: Array<{ query: string; results: RetailerProduct[]; error?: { code: RetailerErrorCode; message: string } }> }>("/search-batch", { method: "POST", body: JSON.stringify({ queries }) });
  return result.results;
}
const productSearch=createSearchCache(fetchSearchBatch);
export const searchBatch=productSearch.search;
export const clearSearchCache=productSearch.clear;

export async function addToBasket(
  items: Array<{ productId: string; qty: number }>,
  attemptId: string,
  /** Treat the quantities as what the basket should hold, not what to add on top. */
  absolute = false,
): Promise<{ added: unknown[]; failed: unknown[]; basket: RetailerBasket }> {
  if (direct) return writeDirect(direct, items, absolute);
  return request("/basket", { method: "POST", body: JSON.stringify({ items, attemptId, absolute }) });
}

/**
 * Take things back out. No ids means the whole basket.
 *
 * Removal is the same Tesco write as adding with a quantity of zero, so
 * repeating it is safe in the same way: gone twice is still gone.
 */
export async function removeFromBasket(
  attemptId: string,
  productIds?: string[],
): Promise<{ removed: unknown[]; failed: unknown[]; basket: RetailerBasket }> {
  if (direct) {
    const basket = await direct.readBasket().catch((error) => { throw asRetailerError(error); });
    const targets = (productIds ?? basket.items.map((item) => item.id)).filter((id) =>
      basket.items.some((item) => item.id === id),
    );
    const result = await writeDirect(direct, targets.map((productId) => ({ productId, qty: 0 })), true);
    return { removed: result.added, failed: result.failed, basket: result.basket };
  }
  return request("/basket/remove", { method: "POST", body: JSON.stringify({ attemptId, productIds }) });
}

/**
 * Write each line, then read the basket to see what actually happened.
 *
 * The same shape the server returns, and for the same reasons: one line
 * failing must not abandon the rest, and what Tesco holds afterwards is the
 * only account of it worth believing. Retrying is safe because the quantity
 * is absolute, so writing "3" twice leaves 3.
 */
async function writeDirect(
  transport: Transport,
  items: Array<{ productId: string; qty: number }>,
  absolute: boolean,
): Promise<{ added: unknown[]; failed: unknown[]; basket: RetailerBasket }> {
  const before = absolute ? null : await transport.readBasket().catch(() => null);
  const refused = new Map<string, string>();

  for (const item of items) {
    const target = absolute ? item.qty : item.qty + (before?.items.find((i) => i.id === item.productId)?.qty ?? 0);
    try {
      await transport.setQuantity(item.productId, target);
    } catch (error) {
      const wrapped = asRetailerError(error);
      // A dead session will not improve on the next product.
      if (wrapped.code === "SESSION_EXPIRED" || wrapped.code === "SESSION_MISSING") throw wrapped;
      refused.set(item.productId, wrapped.message);
    }
  }

  const basket = await transport.readBasket().catch((error) => { throw asRetailerError(error); });
  const held = new Map(basket.items.map((item) => [item.id, item.qty]));
  const added = items.filter((item) => (held.get(item.productId) ?? 0) >= item.qty && item.qty > 0);
  const gone = items.filter((item) => item.qty === 0 && !held.has(item.productId));
  const failed = items
    .filter((item) => !added.includes(item) && !gone.includes(item))
    .map((item) => ({
      productId: item.productId,
      inBasket: held.get(item.productId) ?? 0,
      error: { code: "RETAILER_ERROR", message: refused.get(item.productId) ?? "Tesco did not confirm this line." },
    }));

  return { added: [...added, ...gone], failed, basket };
}

function asRetailerError(error: unknown): RetailerError {
  if (error instanceof RetailerError) return error;
  const code = (error as { code?: RetailerErrorCode }).code ?? "RETAILER_ERROR";
  return new RetailerError(code, error instanceof Error ? error.message : String(error));
}
