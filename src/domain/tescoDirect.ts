import type { RetailerBasket } from "./retailerClient";
import type { RetailerProduct } from "./liveMatch";

const XAPI = "https://xapi.tesco.com/";
/** How many ingredients may be looked up at the same time. */
const AT_ONCE = 3;
/** A complaint that means "sign in", as opposed to any other kind. */
const SOUNDS_LIKE_AUTH = /unauthor|unauthen|forbidden|token|session|sign ?in|not logged/i;
const SEARCH = "https://search.api.tesco.com/search";

/** The headers a Tesco page adds that cookies alone will not supply. */
export interface TescoHeaders {
  authorization?: string;
  "x-apikey"?: string;
  "customer-uuid"?: string;
  [key: string]: string | undefined;
}

export interface Transport {
  searchBatch(queries: string[], limit?: number): Promise<Array<{ query: string; results: RetailerProduct[]; error?: { code: string; message: string } }>>;
  readBasket(): Promise<RetailerBasket>;
  setQuantity(productId: string, qty: number): Promise<void>;
  removeItem(productId: string): Promise<void>;
}

export class TescoError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/**
 * Tesco, spoken to directly from the browser.
 *
 * The local server exists for one reason: a web page may not call
 * xapi.tesco.com, because Tesco does not invite other origins to. An extension
 * may, and that changes what has to be handled far more than it changes the
 * code. There is no session to capture, store, guard or refresh here: the
 * browser sends its own Tesco cookies, exactly as it does when a person clicks
 * around the site, and the app never sees them. The only things that must be
 * borrowed are the two headers a Tesco page adds and a cookie jar does not.
 */
/**
 * The last thing Tesco actually said, for the panel to report.
 *
 * A gate that says "you are not signed in" is our conclusion, not Tesco's
 * words. When the conclusion is visibly wrong the words are the only way
 * forward, so they are kept: a status and a short reason, never a token.
 */
let lastAnswer = "";
export function lastTescoAnswer(): string {
  return lastAnswer;
}

/**
 * The same, for the half of a search that finds product numbers.
 *
 * That step and the step that describes them are different hosts with
 * different rules, and one can fail while the other is perfectly happy. When
 * it does, every line on the list says the same unhelpful thing, so the status
 * or the refusal itself is the only way to tell a blocked caller from a
 * rate-limited one from a shop with nothing on the shelf.
 */
let lastSearch = "";
export function lastTescoSearchAnswer(): string {
  return lastSearch;
}

export function createTescoTransport({
  headers,
  renew,
  fetch: doFetch = globalThis.fetch,
}: {
  headers: () => Promise<TescoHeaders | undefined>;
  /** Fetch a fresh token, when the one we hold has aged out. */
  renew?: () => Promise<void>;
  fetch?: typeof globalThis.fetch;
}): Transport {
  async function gql<T>(
    operations: Array<{ operationName: string; query: string; variables: unknown }>,
    renewed = false,
  ): Promise<T[]> {
    // Try it, whether or not a token was borrowed.
    //
    // Refusing to ask because we have not seen a Bearer token was a
    // precondition of my own invention: the browser is sending Tesco's own
    // cookies either way, and Tesco is the only thing that actually knows
    // whether that is enough. Asking costs one request and replaces a guess
    // with an answer; refusing to ask guarantees the answer is never found.
    const borrowed = await headers();

    let response: Response;
    try {
      response = await doFetch(XAPI, {
      method: "POST",
      // The browser's own Tesco cookies. Nothing is copied, kept, or written
      // down anywhere by this app.
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(borrowed?.authorization ? { authorization: borrowed.authorization } : {}),
        ...(borrowed?.["x-apikey"] ? { "x-apikey": borrowed["x-apikey"] } : {}),
        ...(borrowed?.["customer-uuid"] ? { "customer-uuid": borrowed["customer-uuid"] } : {}),
      },
      body: JSON.stringify(operations),
      });
    } catch (error) {
      // A blocked or refused request never gets a status, and "not signed in"
      // is the wrong thing to conclude from one.
      lastAnswer = `the request itself failed: ${(error as Error).message.slice(0, 90)}`;
      throw new TescoError("OFFLINE", "The request to Tesco did not get through.");
    }

    const sent = ["authorization", "x-apikey", "customer-uuid"].filter((name) => borrowed?.[name]);
    lastAnswer = `${response.status} ${response.statusText || ""}`.trim() + `, sent: ${sent.join(", ") || "nothing but cookies"}`;

    if (response.status === 401 || response.status === 403) {
      // A token lasts about an hour, so the common cause of a 403 is not that
      // the shopper signed out but that the app is holding yesterday's token
      // and has no reason to doubt it. Get a fresh one and ask again, once,
      // before telling someone plainly signed in that they are not.
      if (renew && !renewed) {
        await renew().catch(() => {});
        return gql<T>(operations, true);
      }
      throw new TescoError("SESSION_EXPIRED", "Tesco needs you to sign in again. Open a Tesco tab, then try again.");
    }
    if (response.status === 429) {
      throw new TescoError("RATE_LIMITED", "Tesco is asking us to slow down.");
    }
    if (!response.ok) {
      throw new TescoError("RETAILER_ERROR", `Tesco answered with ${response.status}.`);
    }

    const body = await response.json().catch(() => null);
    if (body === null) {
      lastAnswer = `${response.status}, but the answer was not JSON`;
      throw new TescoError("RETAILER_ERROR", "Tesco answered with something we could not read.");
    }
    const answers = Array.isArray(body) ? body : [body];
    const complaint = answers.flatMap((a) => (a as { errors?: Array<{ message?: string }> })?.errors ?? [])[0]?.message;
    if (complaint) lastAnswer = `${response.status}, and Tesco said: ${complaint.slice(0, 90)}`;
    return answers;
  }

  async function basketId(): Promise<string> {
    const [answer] = await gql<{ data?: { basket?: { id?: string } } }>([
      { operationName: "GetBasket", query: GET_BASKET, variables: {} },
    ]);
    const id = answer?.data?.basket?.id;
    if (!id) throw new TescoError("SESSION_EXPIRED", "Tesco did not give us a basket. Open a Tesco tab and try again.");
    return id;
  }

  return {
    async searchBatch(queries, limit = 5) {
      // A few at a time, not all at once.
      //
      // Every ingredient is its own search, and each one asks Tesco to
      // describe five products, so a ten-line list arrived as fifty lookups in
      // the same breath. Tesco answered some of them and quietly dropped the
      // rest, which reached the list as "found products but would not describe
      // them" on a random handful of lines while their neighbours priced up
      // perfectly. Asking politely gets the whole list.
      return atATime(AT_ONCE, queries, async (query) => {
        try {
          return { query, results: await search(query, limit, doFetch, gql) };
        } catch (error) {
          const code = error instanceof TescoError ? error.code : "RETAILER_ERROR";
          // A dead session is the whole shop's problem, not this line's.
          if (code === "SESSION_EXPIRED" || code === "SESSION_MISSING") throw error;
          return { query, results: [], error: { code, message: (error as Error).message } };
        }
      });
    },

    async readBasket() {
      const [answer] = await gql<{ data?: { basket?: BasketResponse } }>([
        { operationName: "GetBasket", query: GET_BASKET, variables: {} },
      ]);
      return readBasketFrom(answer?.data?.basket);
    },

    async setQuantity(productId, qty) {
      const orderId = await basketId();
      await gql([{ operationName: "UpdateBasket", query: UPDATE_BASKET, variables: {
        orderId,
        items: [{ adjustment: false, id: productId, newValue: qty, newUnitChoice: "pcs" }],
      } }]);
    },

    async removeItem(productId) {
      // Removal is the same mutation with a quantity of zero. There is no
      // delete: this is what "gone twice is still gone" rests on.
      await this.setQuantity(productId, 0);
    },
  };
}

interface BasketResponse {
  splitView?: Array<{ totalPrice?: string | number; items?: BasketLine[] }> | { totalPrice?: string | number; items?: BasketLine[] };
}
interface BasketLine {
  id?: string;
  quantity?: number;
  product?: { id?: string; title?: string; price?: { actual?: number } };
}

/** The basket, in the shape the rest of the app already understands. */
export function readBasketFrom(basket: BasketResponse | undefined): RetailerBasket {
  const view = Array.isArray(basket?.splitView) ? basket?.splitView[0] : basket?.splitView;
  const lines = view?.items ?? [];
  return {
    items: lines.map((line) => ({
      // product.id is the TPNC, which is what UpdateBasket wants back. The
      // line id is a different number and using it here would mean a basket
      // we can read and cannot change.
      id: String(line.product?.id ?? ""),
      title: String(line.product?.title ?? ""),
      qty: Number(line.quantity ?? 1),
      price: Number(line.product?.price?.actual ?? 0),
    })).filter((item) => item.id !== ""),
    total: Number(view?.totalPrice ?? 0),
  };
}

/**
 * Search, which Tesco splits in two: a public endpoint that knows which
 * products match a word, and an authenticated one that knows anything else
 * about them.
 */
/**
 * Run a job over each item, a few at a time, answers in the order asked.
 *
 * Promise.all is the obvious thing and the wrong one here: it starts
 * everything at once, which is exactly what Tesco declines to serve.
 */
async function atATime<In, Out>(width: number, items: In[], job: (item: In) => Promise<Out>): Promise<Out[]> {
  const answers = new Array<Out>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const mine = next++;
      answers[mine] = await job(items[mine]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker));
  return answers;
}

async function search(
  query: string,
  limit: number,
  doFetch: typeof globalThis.fetch,
  gql: <T>(ops: Array<{ operationName: string; query: string; variables: unknown }>) => Promise<T[]>,
): Promise<RetailerProduct[]> {
  const url = `${SEARCH}?distchannel=ghs&count=${limit}&offset=0&query=${encodeURIComponent(query)}`;

  let found: Response;
  try {
    found = await doFetch(url, { headers: { accept: "application/json" } });
  } catch (error) {
    // No status at all: the request never left, which is a different fault
    // from Tesco turning it down and has a different fix.
    lastSearch = `the search request did not get through: ${(error as Error).message.slice(0, 80)}`;
    throw new TescoError("OFFLINE", "The search request to Tesco did not get through.");
  }

  lastSearch = `${found.status} ${found.statusText || ""}`.trim();
  if (!found.ok) throw new TescoError("RETAILER_ERROR", `Tesco search answered with ${found.status}.`);

  const body = await found.json().catch(() => null);
  if (body === null) {
    lastSearch = `${found.status}, but the answer was not JSON`;
    throw new TescoError("RETAILER_ERROR", "Tesco search answered with something we could not read.");
  }
  const tpnbs: string[] = (body?.uk?.ghs?.products?.results ?? [])
    .map((r: { tpnb?: unknown }) => String(r?.tpnb ?? ""))
    .filter(Boolean)
    .slice(0, limit);
  lastSearch = `${lastSearch}, ${tpnbs.length} found for "${query}"`;
  if (tpnbs.length === 0) return [];

  const answers = await gql<{ data?: { product?: RawProduct }; errors?: Array<{ message?: string }> }>(
    tpnbs.map((tpnb) => ({ operationName: "GetProductByTpnb", query: PRODUCT_BY_TPNB, variables: { tpnb } })),
  );
  const products = answers.map((a) => a?.data?.product).filter(Boolean) as RawProduct[];

  // The first step is unauthenticated and the second is not, so a dead session
  // looks exactly like an empty shelf. Finding names and then nothing about any
  // of them is not an empty shelf.
  if (products.length === 0) {
    // But it is not necessarily a dead session either, and saying so sends
    // someone off to sign in again when they are already signed in. Tesco
    // refusing to answer says nothing; Tesco explaining itself says what is
    // actually wrong, and a complaint about the question we asked is our fault,
    // not the shopper's.
    const complaint = answers.flatMap((a) => a?.errors ?? []).map((e) => e?.message).filter(Boolean)[0];
    if (complaint && SOUNDS_LIKE_AUTH.test(complaint)) {
      lastSearch = `${lastSearch}, and Tesco said: ${complaint.slice(0, 120)}`;
      throw new TescoError("SESSION_EXPIRED", "Tesco needs you to sign in again. Open a Tesco tab, then try again.");
    }
    if (complaint) {
      lastSearch = `${lastSearch}, and Tesco said: ${complaint.slice(0, 120)}`;
      throw new TescoError("RETAILER_ERROR", `Tesco would not describe its own products: ${complaint.slice(0, 120)}`);
    }
    lastSearch = `${lastSearch}, but none of them could be described, and Tesco gave no reason`;
    throw new TescoError("SESSION_EXPIRED", "Tesco found products but would not describe them. Open a Tesco tab and try again.");
  }

  return products
    .map((p) => ({
      id: String(p.id ?? ""),
      title: String(p.title ?? ""),
      price: Number(p.price?.actual ?? 0),
      url: p.id ? `https://www.tesco.com/groceries/en-GB/products/${p.id}` : undefined,
    }))
    .filter((p) => p.id !== "" && p.price > 0);
}

interface RawProduct { id?: string; title?: string; price?: { actual?: number } }

const GET_BASKET = `query GetBasket($basketContexts: [BasketContextType]) {
  basket(basketContexts: $basketContexts) {
    id
    splitView { id totalPrice totalItems items { id quantity cost product { id tpnb title price { actual } } } }
  }
}`;

const UPDATE_BASKET = `mutation UpdateBasket($items: [BasketLineItemInputType], $orderId: ID) {
  basket(items: $items, orderId: $orderId) {
    id
    splitView { id totalPrice totalItems items { id quantity cost product { id title } } }
  }
}`;

const PRODUCT_BY_TPNB = `query GetProductByTpnb($tpnb: String) {
  product(tpnb: $tpnb) { id gtin title price { actual } defaultImageUrl }
}`;
