import type { Ingredient, Recipe } from "./types";

/** What we know about one ingredient, from having asked Tesco for it. */
export type Stocked = "yes" | "no" | "unknown";

export type Stock = Map<string, Stocked>;

export interface MealStock {
  state: "ready" | "short" | "unknown";
  /** Ingredients Tesco had nothing for. Named, because that is what you decide on. */
  missing: string[];
  /** How much of the meal we have actually asked about yet. */
  checked: number;
  total: number;
}

/**
 * Whether a meal can be shopped, from what we already asked Tesco.
 *
 * The point of checking in the background is that choosing a dinner and
 * finding out whether it can be bought should be the same moment. A meal is
 * only "short" once we know something is missing. Until every ingredient has
 * been asked about it stays unknown, because an amber flag on an ingredient we
 * simply have not got to yet would be a lie.
 */
export function mealStock(recipe: Recipe, stock: Stock, ingredients: Ingredient[]): MealStock {
  const nameOf = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id;

  const missing: string[] = [];
  let checked = 0;

  for (const line of recipe.ingredients) {
    const known = stock.get(line.ingredientId) ?? "unknown";
    if (known === "unknown") continue;
    checked += 1;
    if (known === "no") missing.push(nameOf(line.ingredientId));
  }

  const total = recipe.ingredients.length;
  if (missing.length > 0) return { state: "short", missing, checked, total };
  if (checked < total) return { state: "unknown", missing, checked, total };
  return { state: "ready", missing, checked, total };
}

/**
 * Every ingredient the catalogue could ask for, once each.
 *
 * Ingredients are shared heavily between meals: onions are in a third of
 * them, so asking per meal would be asking the same question dozens of times.
 */
export function ingredientsToCheck(recipes: Recipe[]): string[] {
  const seen = new Set<string>();
  for (const recipe of recipes) {
    for (const line of recipe.ingredients) seen.add(line.ingredientId);
  }
  return [...seen];
}

/**
 * Order the asking so the answers arrive where they are most useful first.
 *
 * An ingredient in ten meals settles ten cards; one in a single meal settles
 * one. Checking the common ones first means the grid fills in from the top
 * rather than at random.
 */
export function checkOrder(recipes: Recipe[]): string[] {
  const uses = new Map<string, number>();
  for (const recipe of recipes) {
    for (const line of recipe.ingredients) {
      uses.set(line.ingredientId, (uses.get(line.ingredientId) ?? 0) + 1);
    }
  }
  return [...uses.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);
}
