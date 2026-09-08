import { describe, expect, it } from "vitest";
import { matchToProducts, packsFor } from "../match";
import { consolidate } from "../consolidate";
import { INGREDIENTS } from "../../data/ingredients";
import { PRODUCTS } from "../../data/products";
import { RECIPES } from "../../data/recipes";
import type { Ingredient, Product, Requirement } from "../types";

const catalogue = { ingredients: INGREDIENTS, recipes: RECIPES };

function requirement(ingredient: Ingredient, qty: number): Requirement {
  return { ingredient, qty, unit: ingredient.unit, sources: [{ recipeId: "r", recipeName: "Test", qty }] };
}

const mince: Ingredient = { id: "beef-mince", name: "Beef mince", unit: "g", aisle: "meat-fish" };
const small: Product = { id: "small", ingredientId: "beef-mince", name: "Mince", size: "500g", packQty: 500, price: 4.4 };
const large: Product = { id: "large", ingredientId: "beef-mince", name: "Mince", size: "750g", packQty: 750, price: 6.15 };

describe("packsFor", () => {
  it("rounds up to whole packs", () => {
    expect(packsFor(900, 400)).toBe(3);
    expect(packsFor(400, 400)).toBe(1);
  });

  it("does not buy a second pack for floating-point dust", () => {
    expect(packsFor(0.1 + 0.2, 0.3)).toBe(1);
    expect(packsFor(1200.0000000001, 400)).toBe(3);
  });

  it("buys at least one pack for any real need", () => {
    expect(packsFor(1, 900)).toBe(1);
    expect(packsFor(0, 900)).toBe(0);
  });
});

describe("matchToProducts", () => {
  it("picks the pack combination that costs least", () => {
    // 1kg of mince: two 500g packs (£8.80) beats two 750g packs (£12.30).
    const [line] = matchToProducts([requirement(mince, 1000)], [small, large]).lines;
    expect(line.product.id).toBe("small");
    expect(line.packs).toBe(2);
    expect(line.cost).toBe(8.8);
  });

  it("prefers the bigger pack when it is the cheaper way to cover the need", () => {
    // 600g: one 750g pack (£6.15) beats two 500g packs (£8.80).
    const [line] = matchToProducts([requirement(mince, 600)], [small, large]).lines;
    expect(line.product.id).toBe("large");
    expect(line.packs).toBe(1);
    expect(line.surplus).toBe(150);
  });

  it("offers the runners-up as alternatives", () => {
    const [line] = matchToProducts([requirement(mince, 600)], [small, large]).lines;
    expect(line.alternatives.map((p) => p.id)).toEqual(["small"]);
  });

  it("honours the shopper's own choice of product over the cheapest", () => {
    const [line] = matchToProducts([requirement(mince, 600)], [small, large], {
      prefer: { "beef-mince": "small" },
    }).lines;
    expect(line.product.id).toBe("small");
    expect(line.packs).toBe(2);
    expect(line.alternatives.map((p) => p.id)).toEqual(["large"]);
  });

  it("falls back to the cheapest when the preferred product is gone", () => {
    const [line] = matchToProducts([requirement(mince, 600)], [small, large], {
      prefer: { "beef-mince": "discontinued" },
    }).lines;
    expect(line.product.id).toBe("large");
  });

  it("skips ingredients already in the cupboard", () => {
    const result = matchToProducts([requirement(mince, 600)], [small, large], {
      pantry: new Set(["beef-mince"]),
    });
    expect(result.lines).toHaveLength(0);
    expect(result.skipped[0].ingredient.id).toBe("beef-mince");
  });

  it("reports an ingredient the shop does not stock", () => {
    const truffle: Ingredient = { id: "truffle", name: "Truffle", unit: "g", aisle: "produce" };
    const result = matchToProducts([requirement(truffle, 20)], [small]);
    expect(result.unmatched[0].ingredient.id).toBe("truffle");
    expect(result.lines).toHaveLength(0);
  });

  it("works end to end on the five meals from the brief", () => {
    const plan = ["bolognese", "fajitas", "cottage-pie", "chicken-curry", "salmon-potatoes"].map((recipeId, i) => ({
      key: `k${i}`,
      recipeId,
      servings: 4,
    }));
    const { lines, skipped, unmatched } = matchToProducts(
      consolidate(plan, catalogue),
      PRODUCTS,
      { pantry: new Set(INGREDIENTS.filter((i) => i.staple).map((i) => i.id)) },
    );

    expect(unmatched).toEqual([]);
    expect(skipped.length).toBeGreaterThan(0);

    // Onions are needed by four of the five dinners: 6 in total, and the
    // 1kg bag of 8 covers it for less than three 3-packs.
    const onions = lines.find((l) => l.requirement.ingredient.id === "onion")!;
    expect(onions.requirement.qty).toBe(6);
    expect(onions.packs).toBe(1);
    expect(onions.product.size).toBe("1kg bag");

    // Salmon & Potatoes serves 2, so cooking it for 4 doubles the fish.
    const salmon = lines.find((l) => l.requirement.ingredient.id === "salmon")!;
    expect(salmon.requirement.qty).toBe(480);
    expect(salmon.packs).toBe(2);

    const total = lines.reduce((sum, l) => sum + l.cost, 0);
    expect(total).toBeGreaterThan(30);
    expect(total).toBeLessThan(90);
  });
});
