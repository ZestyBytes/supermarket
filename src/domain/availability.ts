import type { LiveMatch, LiveReview } from "./liveMatch";

/** A meal the shop cannot fully cover, and what is missing from it. */
export interface MealRisk {
  recipeId: string;
  recipeName: string;
  problems: Array<{ ingredientName: string; reason: LiveReview["reason"] }>;
}

/**
 * Turn a list of unresolved ingredients into a list of meals in trouble.
 *
 * "3 ingredients need review" is not a decision anyone can make. "Chicken
 * Curry is missing coconut milk and coriander" is: cook something else, or buy
 * those two yourself. Consolidation makes this possible in the first place —
 * each requirement still remembers which meals asked for it, so an ingredient
 * that four meals share correctly implicates all four.
 *
 * Ordered by how badly each meal is hit, since that is the one you decide first.
 */
export function mealsAtRisk(match: LiveMatch): MealRisk[] {
  const byRecipe = new Map<string, MealRisk>();

  for (const item of match.review) {
    for (const source of item.requirement.sources) {
      const risk = byRecipe.get(source.recipeId) ?? {
        recipeId: source.recipeId,
        recipeName: source.recipeName,
        problems: [],
      };
      risk.problems.push({ ingredientName: item.requirement.ingredient.name, reason: item.reason });
      byRecipe.set(source.recipeId, risk);
    }
  }

  return [...byRecipe.values()].sort(
    (a, b) => b.problems.length - a.problems.length || a.recipeName.localeCompare(b.recipeName),
  );
}

/** Plain English for why one ingredient could not be settled. */
export function reasonText(reason: LiveReview["reason"]): string {
  switch (reason) {
    case "no-results":
      return "Tesco has nothing matching";
    case "search-failed":
      return "the search did not complete";
  }
}
