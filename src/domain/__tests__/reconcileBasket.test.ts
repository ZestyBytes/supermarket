import { describe, expect, it } from "vitest";
import { reconcileBasket, settled, type BasketChange } from "../reconcileBasket";
import type { LiveMatch } from "../liveMatch";
import type { RetailerBasket } from "../retailerClient";

function plan(...lines: Array<[string, number]>): LiveMatch {
  return {
    choices: lines.map(([id, packs], n) => ({
      requirement: { ingredient: { id: `i${n}`, name: id, unit: "g", aisle: "produce" }, qty: 1, unit: "g", sources: [] },
      product: { id, title: id, price: 1 },
      packQty: 1, packs, cost: packs, surplus: 0, alternatives: [], candidates: [],
    })),
    review: [],
  } as unknown as LiveMatch;
}

function basket(...lines: Array<[string, number]>): RetailerBasket {
  return { total: 0, items: lines.map(([id, qty]) => ({ id, title: id, qty, price: 1 })) };
}

const sorted = (c: BasketChange) => ({ set: [...c.set].sort((a, b) => a.productId.localeCompare(b.productId)), remove: [...c.remove].sort() });

describe("keeping the basket in step with the week", () => {
  it("puts in what the plan wants and the basket has not got", () => {
    const change = reconcileBasket(plan(["a", 2]), basket(), new Set());
    expect(change.set).toEqual([{ productId: "a", qty: 2 }]);
    expect(change.remove).toEqual([]);
  });

  it("says nothing when the basket already matches", () => {
    expect(settled(reconcileBasket(plan(["a", 2]), basket(["a", 2]), new Set(["a"])))).toBe(true);
  });

  it("corrects a quantity rather than adding to it", () => {
    // Cooking for eight instead of four asks for more of the same product.
    const change = reconcileBasket(plan(["a", 4]), basket(["a", 2]), new Set(["a"]));
    expect(change.set).toEqual([{ productId: "a", qty: 4 }]);
  });

  it("takes out what the plan no longer wants", () => {
    // A meal removed, or its ingredient ticked off as already in the cupboard.
    const change = reconcileBasket(plan(["a", 1]), basket(["a", 1], ["b", 1]), new Set(["a", "b"]));
    expect(change.remove).toEqual(["b"]);
    expect(change.set).toEqual([]);
  });

  it("never proposes removing shopping it did not add", () => {
    // The wine someone else put in is not ours to take out, and this is the
    // reason that is true by construction rather than by good intentions.
    const change = reconcileBasket(plan(["a", 1]), basket(["a", 1], ["wine", 1]), new Set(["a"]));
    expect(change.remove).toEqual([]);
  });

  it("adds the packs up when two meals want the same product", () => {
    const change = reconcileBasket(plan(["onions", 1], ["onions", 2]), basket(), new Set());
    expect(change.set).toEqual([{ productId: "onions", qty: 3 }]);
  });

  it("empties our lines when the week is cleared", () => {
    const change = reconcileBasket(null, basket(["a", 1], ["b", 2], ["wine", 1]), new Set(["a", "b"]));
    expect(sorted(change)).toEqual({ set: [], remove: ["a", "b"] });
  });

  it("proposes nothing before the basket has been read", () => {
    const change = reconcileBasket(plan(["a", 1]), null, new Set());
    expect(change.set).toEqual([{ productId: "a", qty: 1 }]);
    expect(change.remove).toEqual([]);
  });
});
