import type { RetailerProduct } from "./liveMatch";

/**
 * Talks to the local server, which is the only thing that holds the session.
 *
 * Every failure the server can report has a code, because the app must tell
 * "you are signed out" apart from "nothing found" — showing an empty
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
  /** The retailer's own total. Authoritative — it knows about delivery and offers. */
  total: number;
}

const BASE = "/api";

/**
 * Whether a local server could possibly be listening for this page.
 *
 * The session lives in a process on the shopper's own machine, reached through
 * the dev server's `/api` proxy. A build served from anywhere else — GitHub
 * Pages, a phone on the sofa — has no such process behind `/api`, and the
 * requests land on the static host instead, which answers 404 in HTML. That
 * is indistinguishable from a retailer fault unless we check first, so the
 * app asks this before offering to talk to a retailer at all.
 */
export function hasLocalServer(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
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
    // No JSON body at all means nothing that speaks our protocol answered —
    // a static host serving its own 404 page, not a retailer refusing us.
    if (!payload) {
      throw new RetailerError(
        "OFFLINE",
        hasLocalServer()
          ? "The local server is not running. Start it with: npm run server"
          : "This copy is served as a static site, so there is no local server to reach. Run it on your own machine to use a real basket.",
      );
    }
    const error = payload.error;
    throw new RetailerError(error?.code ?? "RETAILER_ERROR", error?.message ?? `Request failed (${response.status}).`);
  }
  return payload as T;
}

export async function getSession(): Promise<{ session: SessionState; mode: "live" | "mock" }> {
  return request("/session");
}

export async function search(query: string, limit = 8): Promise<RetailerProduct[]> {
  const { results } = await request<{ results: RetailerProduct[] }>(
    `/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  return results;
}

export async function readBasket(): Promise<RetailerBasket> {
  const { basket } = await request<{ basket: RetailerBasket }>("/basket");
  return basket;
}

export async function addToBasket(
  items: Array<{ productId: string; qty: number }>,
): Promise<{ added: unknown[]; failed: unknown[]; basket: RetailerBasket }> {
  return request("/basket", { method: "POST", body: JSON.stringify({ items }) });
}
