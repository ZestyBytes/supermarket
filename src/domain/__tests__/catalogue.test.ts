import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../../data/ingredients";
import { PRODUCTS } from "../../data/products";
import { RECIPES } from "../../data/recipes";
import { toCanonical } from "../units";

const ingredientIds = new Set(INGREDIENTS.map((i) => i.id));
const stocked = new Set(PRODUCTS.map((p) => p.ingredientId));

describe("catalogue integrity", () => {
  it("has unique ids", () => {
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it("stocks a product for every ingredient", () => {
    const missing = INGREDIENTS.filter((i) => !stocked.has(i.id)).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it("only sells products for ingredients that exist", () => {
    const orphans = PRODUCTS.filter((p) => !ingredientIds.has(p.ingredientId)).map((p) => p.id);
    expect(orphans).toEqual([]);
  });

  it("prices every pack sensibly", () => {
    for (const product of PRODUCTS) {
      expect(product.packQty, product.id).toBeGreaterThan(0);
      expect(product.price, product.id).toBeGreaterThan(0);
      if (product.was) expect(product.was, product.id).toBeGreaterThan(product.price);
    }
  });

  it("writes every recipe line in a unit its ingredient can be measured in", () => {
    for (const recipe of RECIPES) {
      for (const line of recipe.ingredients) {
        const ingredient = INGREDIENTS.find((i) => i.id === line.ingredientId);
        expect(ingredient, `${recipe.name} → ${line.ingredientId}`).toBeDefined();
        expect(() => toCanonical(line.qty, line.unit, ingredient!)).not.toThrow();
        expect(line.qty, `${recipe.name} → ${line.ingredientId}`).toBeGreaterThan(0);
      }
    }
  });

  it("covers the five dinners from the brief", () => {
    const names = RECIPES.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Spaghetti Bolognese",
        "Chicken Fajitas",
        "Cottage Pie",
        "Chicken Curry",
        "Salmon & Potatoes",
      ]),
    );
  });
});
