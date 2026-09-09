import { describe, expect, it } from "vitest";
import { mealsAtRisk } from "../availability";
import type { LiveMatch } from "../liveMatch";
import type { Ingredient, Requirement } from "../types";

const ingredient = (id: string, name: string): Ingredient => ({ id, name, unit: "g", aisle: "cupboard" });

function requirement(id: string, name: string, sources: Array<[string, string]>): Requirement {
  return {
    ingredient: ingredient(id, name),
    qty: 100,
    unit: "g",
    sources: sources.map(([recipeId, recipeName]) => ({ recipeId, recipeName, qty: 100 })),
  };
}

const match = (review: LiveMatch["review"]): LiveMatch => ({ choices: [], review });

describe("mealsAtRisk", () => {
  it("names the meals a missing ingredient actually affects", () => {
    const risks = mealsAtRisk(
      match([
        { requirement: requirement("coconut", "Coconut milk", [["curry", "Chicken Curry"]]), reason: "no-results", candidates: [] },
      ]),
    );
    expect(risks).toHaveLength(1);
    expect(risks[0].recipeName).toBe("Chicken Curry");
    expect(risks[0].problems[0].ingredientName).toBe("Coconut milk");
  });

  it("implicates every meal that shared the ingredient", () => {
    const risks = mealsAtRisk(
      match([
        {
          requirement: requirement("onion", "Onions", [
            ["bol", "Spaghetti Bolognese"],
            ["curry", "Chicken Curry"],
            ["pie", "Cottage Pie"],
          ]),
          reason: "no-results",
          candidates: [],
        },
      ]),
    );
    expect(risks.map((r) => r.recipeName)).toEqual(["Chicken Curry", "Cottage Pie", "Spaghetti Bolognese"]);
  });

  it("puts the worst-hit meal first, so that is the one you decide about", () => {
    const risks = mealsAtRisk(
      match([
        { requirement: requirement("a", "Coconut milk", [["curry", "Curry"]]), reason: "no-results", candidates: [] },
        { requirement: requirement("b", "Coriander", [["curry", "Curry"]]), reason: "no-results", candidates: [] },
        { requirement: requirement("c", "Sausages", [["mash", "Sausages & Mash"]]), reason: "search-failed", candidates: [] },
      ]),
    );
    expect(risks[0].recipeName).toBe("Curry");
    expect(risks[0].problems).toHaveLength(2);
    expect(risks[1].recipeName).toBe("Sausages & Mash");
  });

  it("is empty when everything was found", () => {
    expect(mealsAtRisk(match([]))).toEqual([]);
  });
});
