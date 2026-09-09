import { describe, expect, it } from "vitest";
import { goodsTotal, MINIMUM_BASKET, shortOfMinimum, UNDER_MINIMUM_CHARGE } from "../minimumBasket";

describe("the minimum basket", () => {
  it("says how much more is needed to clear it", () => {
    expect(shortOfMinimum(28.41)).toBe(11.59);
  });

  it("is clear once the basket reaches the minimum exactly", () => {
    expect(shortOfMinimum(MINIMUM_BASKET)).toBe(0);
    expect(shortOfMinimum(MINIMUM_BASKET + 0.01)).toBe(0);
  });

  it("says nothing about an empty basket, which is not an order yet", () => {
    expect(shortOfMinimum(0)).toBe(0);
  });

  it("counts the goods without the retailer's own additions", () => {
    // readBasket's total already carries delivery, so the goods are counted
    // from the lines instead, or the charge would be judged against itself.
    expect(goodsTotal([{ price: 2.5, qty: 2 }, { price: 1.1, qty: 3 }])).toBe(8.3);
    expect(goodsTotal([])).toBe(0);
  });

  it("keeps the charge and the threshold together", () => {
    expect(UNDER_MINIMUM_CHARGE).toBeGreaterThan(0);
    expect(MINIMUM_BASKET).toBeGreaterThan(UNDER_MINIMUM_CHARGE);
  });
});
