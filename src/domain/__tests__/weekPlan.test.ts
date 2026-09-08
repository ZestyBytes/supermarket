import { describe, expect, it } from "vitest";
import { surpriseWeek } from "../weekPlan";
import { RECIPES } from "../../data/recipes";

describe("surpriseWeek", () => {
  it("picks the number of meals asked for", () => {
    expect(surpriseWeek(RECIPES, 5, 4)).toHaveLength(5);
  });

  it("never repeats a meal in one week", () => {
    for (let run = 0; run < 40; run++) {
      const week = surpriseWeek(RECIPES, 5, 4);
      expect(new Set(week.map((m) => m.recipeId)).size).toBe(week.length);
    }
  });

  it("varies the kind of meal rather than serving beef three nights running", () => {
    const kindOf = (id: string) => RECIPES.find((r) => r.id === id)!.tags[0];
    for (let run = 0; run < 40; run++) {
      const kinds = surpriseWeek(RECIPES, 5, 4).map((m) => kindOf(m.recipeId));
      const commonest = Math.max(...[...new Set(kinds)].map((k) => kinds.filter((x) => x === k).length));
      expect(commonest).toBeLessThanOrEqual(2);
    }
  });

  it("carries the servings through to every meal", () => {
    expect(surpriseWeek(RECIPES, 3, 2).every((m) => m.servings === 2)).toBe(true);
  });

  it("gives what it can when asked for more meals than exist", () => {
    expect(surpriseWeek(RECIPES, 99, 4)).toHaveLength(RECIPES.length);
  });
});
