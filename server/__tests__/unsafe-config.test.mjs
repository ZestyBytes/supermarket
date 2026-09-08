import { describe, expect, it } from "vitest";
import { createHttpAdapter } from "../adapters/http.mjs";

const base = {
  baseUrl: "https://xapi.example",
  search: { method: "POST", path: "/", results: "data.results[]", fields: { id: "id" } },
  basket: { read: { method: "POST", path: "/", results: "data.items[]" }, add: { method: "POST", path: "/" } },
};

describe("a read that would change the basket", () => {
  it("is refused before a single request goes out", () => {
    // The retailer batches its basket read with a mutation that sets an item's
    // quantity. Config written before that was noticed still holds the batch.
    const config = {
      ...base,
      basket: {
        ...base.basket,
        read: {
          ...base.basket.read,
          body: JSON.stringify([
            { operationName: "UpdateBasket", query: "mutation UpdateBasket { basket { id } }" },
            { operationName: "GetBasket", query: "query GetBasket { basket { id } }" },
          ]),
        },
      },
    };

    expect(() => createHttpAdapter(config, () => ({ authorization: "Bearer x" }))).toThrow(/UpdateBasket/);
  });

  it("says how to fix it", () => {
    const config = {
      ...base,
      search: { ...base.search, body: '[{"operationName":"Add","query":"mutation Add { x }"}]' },
    };
    expect(() => createHttpAdapter(config, () => ({}))).toThrow(/npm run refresh -- search/);
  });

  it("allows a read that only reads", () => {
    const config = {
      ...base,
      basket: {
        ...base.basket,
        read: { ...base.basket.read, body: '[{"operationName":"GetBasket","query":"query GetBasket { basket { id } }"}]' },
      },
    };
    expect(() => createHttpAdapter(config, () => ({}))).not.toThrow();
  });
});
