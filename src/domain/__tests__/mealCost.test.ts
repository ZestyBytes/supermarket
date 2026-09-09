import { describe, expect, it } from "vitest";
import { mealCost, unitPriceFrom, type UnitPrices } from "../mealCost";
import type { Ingredient, Recipe } from "../types";

const mince: Ingredient = { id: "mince", name: "Beef mince", unit: "g", aisle: "meat-fish" };
const onion: Ingredient = { id: "onion", name: "Onions", unit: "each", aisle: "produce" };
const oil: Ingredient = { id: "oil", name: "Olive oil", unit: "ml", aisle: "cupboard" };
const ingredients = new Map([mince, onion, oil].map((i) => [i.id, i]));

const bolognese: Recipe = {
  id: "bol", name: "Bolognese", serves: 4, minutes: 40, blurb: "", tags: [], emoji: "",
  ingredients: [
    { ingredientId: "mince", qty: 500, unit: "g" },
    { ingredientId: "onion", qty: 2, unit: "each" },
    { ingredientId: "oil", qty: 30, unit: "ml" },
  ],
};

// £6/kg mince, 30p an onion, 60p per 100ml oil.
const prices: UnitPrices = new Map([["mince", 0.006], ["onion", 0.3], ["oil", 0.006]]);

describe("what a dinner costs", () => {
  it("prices the recipe as written, and per head", () => {
    const cost = mealCost(bolognese, 4, prices, ingredients)!;
    // 500g at £6/kg is £3, two onions 60p, 30ml of oil 18p.
    expect(cost.total).toBe(3.78);
    expect(cost.each).toBe(0.95);
  });

  it("scales with the people, leaving the cost per head alone", () => {
    const four = mealCost(bolognese, 4, prices, ingredients)!;
    const eight = mealCost(bolognese, 8, prices, ingredients)!;
    expect(eight.total).toBe(7.56);
    expect(eight.each).toBe(four.each);
  });

  it("charges a share of the pack, not the pack", () => {
    // The point of a unit rate: 500g out of a 1kg bag is half its price, and
    // the other half belongs to whatever else asks for mince that week.
    const cost = mealCost(bolognese, 4, prices, ingredients)!;
    expect(cost.total).toBeLessThan(6 + 0.6 + 0.6);
  });

  it("says nothing rather than guessing when most of it cannot be priced", () => {
    expect(mealCost(bolognese, 4, new Map([["oil", 0.006]]), ingredients)).toBeNull();
  });

  it("still answers when only one ingredient is unknown", () => {
    const partial = mealCost(bolognese, 4, new Map([["mince", 0.006], ["onion", 0.3]]), ingredients)!;
    expect(partial.total).toBe(3.6);
    expect(partial.covered).toBeCloseTo(2 / 3);
  });
});

describe("the unit rate from a shelf", () => {
  it("takes the cheapest per unit, not the cheapest pack", () => {
    const rate = unitPriceFrom(
      [
        { id: "a", title: "Beef Mince 300G", price: 2.4 },
        { id: "b", title: "Beef Mince 1Kg", price: 6.0 },
      ],
      mince,
    );
    expect(rate).toBe(0.006);
  });

  it("ignores products measured in something else, and unreadable ones", () => {
    expect(unitPriceFrom([{ id: "a", title: "Beef Mince 4 Pack", price: 5 }], mince)).toBeUndefined();
    expect(unitPriceFrom([{ id: "b", title: "Beef Mince", price: 5 }], mince)).toBeUndefined();
  });
});
