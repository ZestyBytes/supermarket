import { describe, expect, it } from "vitest";
import { applyPlan, FREE_DELIVERY_OVER, outstanding, totals } from "../basket";
import type { BasketLine } from "../basket";
import type { MatchedLine, Product, Requirement } from "../types";

const cheddar: Product = { id: "sku-cheddar", ingredientId: "cheddar", name: "Cheddar", size: "350g", packQty: 350, price: 3.5 };
const butter: Product = { id: "sku-butter", ingredientId: "butter", name: "Butter", size: "250g", packQty: 250, price: 2.1, was: 2.6 };

const requirement = { ingredient: { id: "x", name: "X", unit: "g", aisle: "dairy" }, qty: 1, unit: "g", sources: [] } as unknown as Requirement;
function matched(product: Product, packs: number): MatchedLine {
  return { requirement, product, packs, cost: packs * product.price, surplus: 0, alternatives: [] };
}

describe("totals", () => {
  it("adds up goods, savings and delivery", () => {
    const lines: BasketLine[] = [
      { product: cheddar, qty: 2, source: "plan" },
      { product: butter, qty: 1, source: "manual" },
    ];
    const t = totals(lines, 2.5);
    expect(t.items).toBe(3);
    expect(t.goods).toBe(9.1);
    expect(t.savings).toBe(0.5);
    expect(t.delivery).toBe(2.5);
    expect(t.total).toBe(11.6);
  });

  it("waives delivery once the basket passes the threshold", () => {
    const lines: BasketLine[] = [{ product: cheddar, qty: 12, source: "plan" }];
    const t = totals(lines, 4.5);
    expect(t.goods).toBeGreaterThanOrEqual(FREE_DELIVERY_OVER);
    expect(t.delivery).toBe(0);
    expect(t.toFreeDelivery).toBe(0);
  });

  it("charges nothing to deliver an empty basket", () => {
    expect(totals([], 4.5)).toMatchObject({ items: 0, goods: 0, delivery: 0, total: 0 });
  });

  it("reports how much more is needed for free delivery", () => {
    expect(totals([{ product: cheddar, qty: 1, source: "plan" }], 2.5).toFreeDelivery).toBe(36.5);
  });
});

describe("applyPlan", () => {
  it("adds planned products to an empty basket", () => {
    const next = applyPlan([], [matched(cheddar, 2)]);
    expect(next).toEqual([{ product: cheddar, qty: 2, source: "plan" }]);
  });

  it("tops up rather than doubling when pressed twice", () => {
    const once = applyPlan([], [matched(cheddar, 2)]);
    const twice = applyPlan(once, [matched(cheddar, 2)]);
    expect(twice).toHaveLength(1);
    expect(twice[0].qty).toBe(2);
  });

  it("keeps a larger quantity the shopper added by hand", () => {
    const next = applyPlan([{ product: cheddar, qty: 5, source: "manual" }], [matched(cheddar, 2)]);
    expect(next[0].qty).toBe(5);
  });

  it("leaves unrelated basket lines alone", () => {
    const next = applyPlan([{ product: butter, qty: 1, source: "manual" }], [matched(cheddar, 1)]);
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual({ product: butter, qty: 1, source: "manual" });
  });
});

describe("outstanding", () => {
  it("reports only the shortfall against the plan", () => {
    const gaps = outstanding([{ product: cheddar, qty: 1, source: "manual" }], [matched(cheddar, 3), matched(butter, 1)]);
    expect(gaps.get("sku-cheddar")).toBe(2);
    expect(gaps.get("sku-butter")).toBe(1);
  });

  it("is empty once the basket covers the plan", () => {
    expect(outstanding([{ product: cheddar, qty: 3, source: "plan" }], [matched(cheddar, 3)]).size).toBe(0);
  });
});
