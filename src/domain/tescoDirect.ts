import type { RetailerBasket } from "./retailerClient";
import type { RetailerProduct } from "./liveMatch";

const XAPI = "https://xapi.tesco.com/";
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
export function createTescoTransport({
  headers,
  fetch: doFetch = globalThis.fetch,
}: {
  headers: () => Promise<TescoHeaders | undefined>;
  fetch?: typeof globalThis.fetch;
}): Transport {
  async function gql<T>(operations: Array<{ operationName: string; query: string; variables: unknown }>): Promise<T[]> {
    const borrowed = await headers();
    if (!borrowed?.authorization) {
      throw new TescoError("SESSION_MISSING", "Open Tesco in a tab and sign in, then try again.");
    }

    const response = await doFetch(XAPI, {
      method: "POST",
      // The browser's own Tesco cookies. Nothing is copied, kept, or written
      // down anywhere by this app.
      credentials: "include",
      headers: {
        "content-type": "application/json",
        authorization: borrowed.authorization,
        ...(borrowed["x-apikey"] ? { "x-apikey": borrowed["x-apikey"] } : {}),
        ...(borrowed["customer-uuid"] ? { "customer-uuid": borrowed["customer-uuid"] } : {}),
      },
      body: JSON.stringify(operations),
    });

    if (response.status === 401 || response.status === 403) {
      throw new TescoError("SESSION_EXPIRED", "Tesco needs you to sign in again. Open a Tesco tab, then try again.");
    }
    if (response.status === 429) {
      throw new TescoError("RATE_LIMITED", "Tesco is asking us to slow down.");
    }
    if (!response.ok) {
      throw new TescoError("RETAILER_ERROR", `Tesco answered with ${response.status}.`);
    }

    const body = await response.json();
    return Array.isArray(body) ? body : [body];
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
      return Promise.all(queries.map(async (query) => {
        try {
          return { query, results: await search(query, limit, doFetch, gql) };
        } catch (error) {
          const code = error instanceof TescoError ? error.code : "RETAILER_ERROR";
          // A dead session is the whole shop's problem, not this line's.
          if (code === "SESSION_EXPIRED" || code === "SESSION_MISSING") throw error;
          return { query, results: [], error: { code, message: (error as Error).message } };
        }
      }));
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
async function search(
  query: string,
  limit: number,
  doFetch: typeof globalThis.fetch,
  gql: <T>(ops: Array<{ operationName: string; query: string; variables: unknown }>) => Promise<T[]>,
): Promise<RetailerProduct[]> {
  const url = `${SEARCH}?distchannel=ghs&count=${limit}&offset=0&query=${encodeURIComponent(query)}`;
  const found = await doFetch(url, { headers: { accept: "application/json" } });
  if (!found.ok) throw new TescoError("RETAILER_ERROR", `Tesco search answered with ${found.status}.`);

  const body = await found.json();
  const tpnbs: string[] = (body?.uk?.ghs?.products?.results ?? [])
    .map((r: { tpnb?: unknown }) => String(r?.tpnb ?? ""))
    .filter(Boolean)
    .slice(0, limit);
  if (tpnbs.length === 0) return [];

  const answers = await gql<{ data?: { product?: RawProduct } }>(
    tpnbs.map((tpnb) => ({ operationName: "GetProductByTpnb", query: PRODUCT_BY_TPNB, variables: { tpnb } })),
  );
  const products = answers.map((a) => a?.data?.product).filter(Boolean) as RawProduct[];

  // The first step is unauthenticated and the second is not, so a dead session
  // looks exactly like an empty shelf. Finding names and then nothing about any
  // of them is not an empty shelf.
  if (products.length === 0) {
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
