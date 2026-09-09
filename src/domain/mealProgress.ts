import type { Requirement } from "./types";

export type MealState = "none" | "working" | "in" | "short";

/**
 * How far a chosen meal has actually got into the basket.
 *
 * A tick the moment you tap says the app heard you, which was never in doubt.
 * What is in doubt, while a week's shopping goes in a few lines at a time, is
 * whether this particular dinner is bought yet, and that is answered by its
 * own ingredients rather than by a total at the bottom of the screen.
 *
 * An ingredient already in the cupboard is not in the basket and never will
 * be, so it cannot count against the meal: it is simply not part of what has
 * to be bought.
 */
export function mealProgress(
  recipeId: string,
  requirements: Requirement[],
  state: (ingredientId: string) => "checking" | "ready" | "missing" | "added" | "failed" | undefined,
): MealState {
  const mine = requirements.filter((requirement) =>
    requirement.sources.some((source) => source.recipeId === recipeId),
  );
  if (mine.length === 0) return "none";

  let wanted = 0;
  let inBasket = 0;
  let unavailable = 0;

  for (const requirement of mine) {
    const status = state(requirement.ingredient.id);
    if (status === undefined) continue;
    wanted += 1;
    if (status === "added") inBasket += 1;
    else if (status === "missing" || status === "failed") unavailable += 1;
  }

  if (wanted === 0) return "in";
  if (inBasket + unavailable < wanted) return "working";
  return unavailable > 0 ? "short" : "in";
}
