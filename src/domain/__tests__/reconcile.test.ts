import { describe, expect, it } from "vitest";
import { reconcile } from "../reconcile";
import type { LiveChoice } from "../liveMatch";
import type { RetailerBasket } from "../retailerClient";

function choice(id: string, ingredient: string, packs: number): LiveChoice {
  return {
    requirement: {
      ingredient: { id: ingredient, name: ingredient, unit: "g", aisle: "cupboard" },
      qty: 100,
      unit: "g",
      sources: [],
    },
    product: { id, title: `Tesco ${ingredient}`, price: 1, url: "" },
    packs,
    cost: packs,
    surplus: 0,
    alternatives: [],
  } as unknown as LiveChoice;
}

const basket = (items: Array<[string, number]>): RetailerBasket => ({
  items: items.map(([id, qty]) => ({ id, qty, title: id, price: 1 })),
  total: 0,
});

describe("reconcile", () => {
  it("says everything is in when the basket holds the whole list", () => {
    const result = reconcile([choice("a", "Onions", 1), choice("b", "Mince", 2)], basket([["a", 1], ["b", 2]]));
    expect(result.done).toBe(2);
    expect(result.problems).toEqual([]);
  });

  it("catches a line that never made it: the half-a-shop case", () => {
    const result = reconcile([choice("a", "Onions", 1), choice("b", "Mince", 2)], basket([["a", 1]]));
    expect(result.done).toBe(1);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].ingredientName).toBe("Mince");
    expect(result.problems[0].state).toBe("missing");
  });

  it("catches a line that went in short", () => {
    const result = reconcile([choice("b", "Mince", 3)], basket([["b", 1]]));
    expect(result.problems[0].state).toBe("short");
    expect(result.problems[0].inBasket).toBe(1);
    expect(result.problems[0].wanted).toBe(3);
  });

  it("counts someone else's shopping without treating it as ours", () => {
    const result = reconcile([choice("a", "Onions", 1)], basket([["a", 1], ["wine", 2], ["crisps", 1]]));
    expect(result.done).toBe(1);
    expect(result.problems).toEqual([]);
    expect(result.othersInBasket).toBe(2);
  });

  it("does not count extra quantity of our own line as a problem", () => {
    const result = reconcile([choice("a", "Onions", 1)], basket([["a", 4]]));
    expect(result.problems).toEqual([]);
    expect(result.lines[0].state).toBe("in");
  });

  it("carries the reason a line failed, when the server gave one", () => {
    const result = reconcile([choice("b", "Mince", 1)], basket([]), [
      { productId: "b", error: { message: "Tesco refused this line." } },
    ]);
    expect(result.problems[0].why).toBe("Tesco refused this line.");
  });
});
