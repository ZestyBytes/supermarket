import { describe, expect, it, vi } from "vitest";
import { createTescoTransport, readBasketFrom, TescoError } from "../tescoDirect";

const HEADERS = { authorization: "Bearer not-a-real-token", "x-apikey": "key" };

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const basketBody = {
  data: { basket: { id: "trn:tesco:order:1", splitView: [{ totalPrice: "12.50", items: [
    { id: "line-1", quantity: 2, product: { id: "tpnc-1", title: "Tesco Onions 1Kg", price: { actual: 1.2 } } },
  ] }] } },
};

describe("talking to Tesco from the browser", () => {
  it("sends the borrowed headers and the browser's own cookies", async () => {
    const fetch = vi.fn(async () => reply([basketBody]));
    const tesco = createTescoTransport({ headers: async () => HEADERS, fetch: fetch as never });

    await tesco.readBasket();

    const [url, init] = (fetch.mock.calls as unknown as Array<[string, RequestInit]>)[0];
    expect(url).toBe("https://xapi.tesco.com/");
    // The whole point: the session is the browser's, never copied into the app.
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>).authorization).toBe(HEADERS.authorization);
  });

  it("asks anyway when no token has been seen, and lets Tesco answer", async () => {
    // The browser sends Tesco's own cookies either way, and Tesco is the only
    // thing that knows whether that is enough. Refusing to ask on our own
    // authority guarantees the answer is never found.
    const fetch = vi.fn(async () => reply([basketBody]));
    const tesco = createTescoTransport({ headers: async () => undefined, fetch: fetch as never });

    await expect(tesco.readBasket()).resolves.toBeDefined();
    const [, init] = (fetch.mock.calls as unknown as Array<[string, RequestInit]>)[0];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(init.credentials).toBe("include");
  });

  it("says you are signed out when that is what Tesco says", async () => {
    const fetch = vi.fn(async () => reply({}, 401));
    const tesco = createTescoTransport({ headers: async () => undefined, fetch: fetch as never });
    await expect(tesco.readBasket()).rejects.toThrow(TescoError);
    await expect(tesco.readBasket()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("reads the basket by product id, not by line id", async () => {
    // UpdateBasket wants the product id back. Using the line id would mean a
    // basket we can read and cannot change, which is worse than not reading it.
    const basket = readBasketFrom(basketBody.data.basket);
    expect(basket.items).toEqual([{ id: "tpnc-1", title: "Tesco Onions 1Kg", qty: 2, price: 1.2 }]);
    expect(basket.total).toBe(12.5);
  });

  it("copes with splitView arriving as an object rather than a list", async () => {
    const basket = readBasketFrom({ splitView: { totalPrice: 3, items: [
      { id: "l", quantity: 1, product: { id: "p", title: "Bread", price: { actual: 1 } } },
    ] } });
    expect(basket.items).toHaveLength(1);
  });

  it("treats an empty basket as empty rather than as a failure", () => {
    expect(readBasketFrom(undefined)).toEqual({ items: [], total: 0 });
    expect(readBasketFrom({ splitView: [] })).toEqual({ items: [], total: 0 });
  });

  it("removes by setting the quantity to zero, because there is no delete", async () => {
    const fetch = vi.fn(async () => reply([basketBody]));
    const tesco = createTescoTransport({ headers: async () => HEADERS, fetch: fetch as never });

    await tesco.removeItem("tpnc-1");

    const calls = fetch.mock.calls as unknown as Array<[string, RequestInit]>;
    const last = JSON.parse(calls[calls.length - 1][1].body as string);
    expect(last[0].operationName).toBe("UpdateBasket");
    expect(last[0].variables.items[0]).toMatchObject({ id: "tpnc-1", newValue: 0 });
    expect(last[0].variables.orderId).toBe("trn:tesco:order:1");
  });

  it("names a signed-out session rather than reporting an empty shelf", async () => {
    // Search is public; the details are not. A dead session looks exactly like
    // "nothing found" unless you notice it found names and then nothing else.
    const fetch = vi.fn(async (url: string) =>
      String(url).includes("search.api")
        ? reply({ uk: { ghs: { products: { results: [{ tpnb: "111" }] } } } })
        : reply([{ errors: [{ message: "unauthorised" }] }]),
    );
    const tesco = createTescoTransport({ headers: async () => HEADERS, fetch: fetch as never });

    await expect(tesco.searchBatch(["onions"])).rejects.toThrow(/sign in|Tesco tab/i);
  });

  it("returns an empty shelf when Tesco genuinely has nothing", async () => {
    const fetch = vi.fn(async () => reply({ uk: { ghs: { products: { results: [] } } } }));
    const tesco = createTescoTransport({ headers: async () => HEADERS, fetch: fetch as never });

    expect(await tesco.searchBatch(["pickled moon"])).toEqual([{ query: "pickled moon", results: [] }]);
  });

  it("maps products, and drops any it cannot price", async () => {
    const fetch = vi.fn(async (url: string) =>
      String(url).includes("search.api")
        ? reply({ uk: { ghs: { products: { results: [{ tpnb: "1" }, { tpnb: "2" }] } } } })
        : reply([
            { data: { product: { id: "p1", title: "Tesco Onions 1Kg", price: { actual: 1.2 } } } },
            { data: { product: { id: "p2", title: "Mystery", price: {} } } },
          ]),
    );
    const tesco = createTescoTransport({ headers: async () => HEADERS, fetch: fetch as never });

    const [answer] = await tesco.searchBatch(["onions"]);
    expect(answer.results).toEqual([
      { id: "p1", title: "Tesco Onions 1Kg", price: 1.2, url: "https://www.tesco.com/groceries/en-GB/products/p1" },
    ]);
  });

  it("turns Tesco's own refusals into the codes the app already handles", async () => {
    for (const [status, code] of [[401, "SESSION_EXPIRED"], [429, "RATE_LIMITED"], [500, "RETAILER_ERROR"]] as const) {
      const fetch = vi.fn(async () => reply({}, status));
      const tesco = createTescoTransport({ headers: async () => HEADERS, fetch: fetch as never });
      await expect(tesco.readBasket()).rejects.toMatchObject({ code });
    }
  });

  it("lets one bad search fail without taking the shop with it", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (String(url).includes("carrots")) return reply({}, 500);
      return String(url).includes("search.api")
        ? reply({ uk: { ghs: { products: { results: [] } } } })
        : reply([]);
    });
    const tesco = createTescoTransport({ headers: async () => HEADERS, fetch: fetch as never });

    const answers = await tesco.searchBatch(["onions", "carrots"]);
    expect(answers[0].error).toBeUndefined();
    expect(answers[1].error?.code).toBe("RETAILER_ERROR");
  });
});

describe("a token that has aged out", () => {
  it("gets a fresh one and asks again, rather than declaring the shopper signed out", async () => {
    // A Tesco token lasts about an hour. Holding a dead one looks exactly like
    // holding a live one until Tesco refuses it, so a 403 is far more often a
    // stale token than a shopper who signed out.
    let token = "Bearer stale";
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const sent = (init.headers as Record<string, string>).authorization;
      return sent === "Bearer fresh" ? reply([basketBody]) : reply({}, 403);
    });

    const tesco = createTescoTransport({
      headers: async () => ({ authorization: token }),
      renew: async () => { token = "Bearer fresh"; },
      fetch: fetch as never,
    });

    await expect(tesco.readBasket()).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after one renewal, so a genuinely signed-out shopper is told", async () => {
    const fetch = vi.fn(async () => reply({}, 403));
    const renew = vi.fn(async () => {});
    const tesco = createTescoTransport({ headers: async () => HEADERS, renew, fetch: fetch as never });

    await expect(tesco.readBasket()).rejects.toBeInstanceOf(TescoError);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("still refuses when a renewal is not possible at all", async () => {
    const fetch = vi.fn(async () => reply({}, 401));
    const tesco = createTescoTransport({ headers: async () => HEADERS, fetch: fetch as never });

    await expect(tesco.readBasket()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
