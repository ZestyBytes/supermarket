import { describe, expect, it } from "vitest";
import { fill, pick, pickAll } from "../pick.mjs";
import { inferFields, inferList } from "../learn.mjs";

/** The shape a batched GraphQL retailer API actually returns. */
const BATCHED = [
  {
    data: {
      search: {
        results: [
          {
            node: {
              __typename: "ProductType",
              id: "254656732",
              tpnb: "081117292",
              title: "Tesco British Chicken Breast Fillets 650G",
              price: { __typename: "ProductPriceType", actual: 4.9, unitPrice: 7.54, unitOfMeasure: "kg" },
            },
          },
          {
            node: {
              __typename: "ProductType",
              id: "254656733",
              title: "Tesco British Chicken Breast Fillets 320G",
              price: { actual: 2.44, unitPrice: 7.63, unitOfMeasure: "kg" },
            },
          },
        ],
      },
    },
  },
];

describe("pick", () => {
  it("walks into a top-level array by index", () => {
    expect(pick(BATCHED, "[0].data.search.results[]")).toHaveLength(2);
  });

  it("reads a value through nesting", () => {
    expect(pick(BATCHED, "[0].data.search.results[0].node.price.actual")).toBe(4.9);
  });

  it("returns undefined for a path that does not exist", () => {
    expect(pick(BATCHED, "[0].data.basket.items[]")).toBeUndefined();
    expect(pick(BATCHED, "[9].data")).toBeUndefined();
  });
});

describe("the batched response end to end", () => {
  it("finds the product list and reads pack prices out of it", () => {
    const path = inferList(BATCHED);
    expect(path).toBe("[0].data.search.results[]");

    const fields = inferFields(pick(BATCHED, path)[0]);
    expect(fields).toMatchObject({
      id: "node.id",
      title: "node.title",
      price: "node.price.actual",
    });

    const rows = pickAll(BATCHED, path, fields);
    expect(rows[0]).toMatchObject({ title: "Tesco British Chicken Breast Fillets 650G", price: 4.9 });
    expect(rows[1].price).toBe(2.44);
  });
});

describe("fill", () => {
  it("percent-encodes into a URL", () => {
    expect(fill("/search?q={query}", { query: "chicken breast" })).toBe("/search?q=chicken%20breast");
  });

  it("JSON-escapes into a body, rather than percent-encoding it", () => {
    // Percent-encoding here would search the retailer for "chicken%20breast".
    expect(fill('{"query":"{query}"}', { query: "chicken breast" }, "json")).toBe('{"query":"chicken breast"}');
  });

  it("escapes quotes that would otherwise break the body", () => {
    expect(fill('{"query":"{query}"}', { query: 'say "hi"' }, "json")).toBe('{"query":"say \\"hi\\""}');
  });

  it("leaves a placeholder alone when no value is given", () => {
    expect(fill("/search?q={query}", {})).toBe("/search?q={query}");
  });
});
