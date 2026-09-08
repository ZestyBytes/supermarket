import { describe, expect, it } from "vitest";
import { consolidate } from "../consolidate";
import { INGREDIENTS } from "../../data/ingredients";
import { RECIPES } from "../../data/recipes";
import type { PlannedMeal } from "../types";

const catalogue = { ingredients: INGREDIENTS, recipes: RECIPES };

function plan(...entries: Array<[string, number?]>): PlannedMeal[] {
  return entries.map(([recipeId, servings], i) => ({
    key: `k${i}`,
    recipeId,
    servings: servings ?? RECIPES.find((r) => r.id === recipeId)?.serves ?? 4,
  }));
}

function need(requirements: ReturnType<typeof consolidate>, id: string) {
  return requirements.find((r) => r.ingredient.id === id);
}

describe("consolidate", () => {
  it("merges an ingredient shared by several meals into one line", () => {
    const requirements = consolidate(plan(["bolognese"], ["fajitas"], ["cottage-pie"], ["chicken-curry"]), catalogue);
    const onions = need(requirements, "onion")!;

    // 1 + 2 + 1 + 2, from four different dinners
    expect(onions.qty).toBe(6);
    expect(onions.sources).toHaveLength(4);
    expect(onions.sources.map((s) => s.recipeName)).toContain("Chicken Fajitas");
    expect(requirements.filter((r) => r.ingredient.id === "onion")).toHaveLength(1);
  });

  it("adds up quantities written in different units", () => {
    // Cottage pie asks for 1.2kg of potato, salmon night for 500g.
    const requirements = consolidate(plan(["cottage-pie"], ["salmon-potatoes"]), catalogue);
    expect(need(requirements, "potato")!.qty).toBe(1700);
  });

  it("scales quantities to the servings each meal is cooked for", () => {
    const four = consolidate(plan(["bolognese", 4]), catalogue);
    const six = consolidate(plan(["bolognese", 6]), catalogue);
    expect(need(four, "beef-mince")!.qty).toBe(500);
    expect(need(six, "beef-mince")!.qty).toBe(750);
  });

  it("counts the same recipe planned twice as one line", () => {
    const requirements = consolidate(plan(["bolognese"], ["bolognese"]), catalogue);
    const mince = need(requirements, "beef-mince")!;
    expect(mince.qty).toBe(1000);
    expect(mince.sources).toHaveLength(1);
    expect(mince.sources[0].qty).toBe(1000);
  });

  it("returns nothing for an empty week", () => {
    expect(consolidate([], catalogue)).toEqual([]);
  });

  it("ignores a meal whose recipe has gone missing", () => {
    expect(consolidate(plan(["no-such-recipe"]), catalogue)).toEqual([]);
  });

  it("groups the list by aisle so it reads like a walk round the shop", () => {
    const aisles = consolidate(plan(["bolognese"], ["chicken-curry"]), catalogue).map((r) => r.ingredient.aisle);
    expect([...aisles]).toEqual([...aisles].sort());
  });

  it("rejects a recipe pointing at an ingredient that does not exist", () => {
    const broken = {
      ingredients: INGREDIENTS,
      recipes: [{ ...RECIPES[0], ingredients: [{ ingredientId: "unobtainium", qty: 1, unit: "each" as const }] }],
    };
    expect(() => consolidate(plan([RECIPES[0].id]), broken)).toThrow(/unknown ingredient/);
  });
});
