import { toCanonical } from "./units";
import type { Ingredient, PlannedMeal, Recipe, Requirement } from "./types";

export interface Catalogue {
  ingredients: Ingredient[];
  recipes: Recipe[];
}

/**
 * Turn a week of planned meals into one requirement per ingredient.
 *
 * Quantities are scaled to the servings each meal is cooked for, converted to
 * the ingredient's own unit, and summed, so onions asked for by three
 * different dinners become a single "5 onions" line that remembers who
 * asked for them.
 */
export function consolidate(plan: PlannedMeal[], catalogue: Catalogue): Requirement[] {
  const ingredientsById = new Map(catalogue.ingredients.map((i) => [i.id, i]));
  const recipesById = new Map(catalogue.recipes.map((r) => [r.id, r]));
  const requirements = new Map<string, Requirement>();

  for (const meal of plan) {
    const recipe = recipesById.get(meal.recipeId);
    if (!recipe) continue;
    const scale = meal.servings / recipe.serves;

    for (const line of recipe.ingredients) {
      const ingredient = ingredientsById.get(line.ingredientId);
      if (!ingredient) {
        throw new Error(`Recipe "${recipe.name}" references unknown ingredient "${line.ingredientId}"`);
      }
      const qty = toCanonical(line.qty, line.unit, ingredient) * scale;

      const existing = requirements.get(ingredient.id);
      if (existing) {
        existing.qty += qty;
        const sameMeal = existing.sources.find((s) => s.recipeId === recipe.id);
        if (sameMeal) sameMeal.qty += qty;
        else existing.sources.push({ recipeId: recipe.id, recipeName: recipe.name, qty });
      } else {
        requirements.set(ingredient.id, {
          ingredient,
          qty,
          unit: ingredient.unit,
          sources: [{ recipeId: recipe.id, recipeName: recipe.name, qty }],
        });
      }
    }
  }

  return [...requirements.values()].sort(
    (a, b) =>
      a.ingredient.aisle.localeCompare(b.ingredient.aisle) ||
      a.ingredient.name.localeCompare(b.ingredient.name),
  );
}
