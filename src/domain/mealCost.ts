import { parsePackSize } from "./packsize";
import { toCanonical } from "./units";
import type { Ingredient, Recipe } from "./types";
import type { RetailerProduct } from "./liveMatch";

/** What one unit of an ingredient costs: pounds per gram, per ml, or per item. */
export type UnitPrices = Map<string, number>;

export interface MealCost {
  /** For the number of people asked for. */
  total: number;
  /** Per person, which is the number worth comparing between dinners. */
  each: number;
  /** How much of the recipe we could actually price, 0 to 1. */
  covered: number;
}

/**
 * What a dinner costs, per unit rather than per pack.
 *
 * A pack is not a meal's cost. Half a 300g bag of mushrooms is half its price,
 * and the other half belongs to whatever else asked for mushrooms that week.
 * Charging the whole pack to the first dinner that mentions it would make the
 * same meal look expensive or cheap depending on what else you happened to
 * pick, which is the opposite of a number you can compare.
 *
 * So this prices by the unit and lets the packs fall where they fall. The
 * total on the shopping list is higher, because you cannot buy 150g of a 300g
 * bag, and that is the honest difference between what a meal costs and what
 * you have to spend to cook it.
 */
export function mealCost(
  recipe: Recipe,
  servings: number,
  prices: UnitPrices,
  ingredients: Map<string, Ingredient>,
): MealCost | null {
  if (recipe.ingredients.length === 0) return null;

  const scale = servings / recipe.serves;
  let total = 0;
  let priced = 0;

  for (const line of recipe.ingredients) {
    const ingredient = ingredients.get(line.ingredientId);
    const rate = prices.get(line.ingredientId);
    if (!ingredient || rate == null) continue;
    total += toCanonical(line.qty, line.unit, ingredient) * scale * rate;
    priced += 1;
  }

  // Below half the shopping list, the number says more about what we could not
  // price than about the dinner.
  const covered = priced / recipe.ingredients.length;
  if (covered < 0.5) return null;

  return {
    total: Math.round(total * 100) / 100,
    each: Math.round((total / Math.max(1, servings)) * 100) / 100,
    covered,
  };
}

/**
 * The best unit rate among what a search returned.
 *
 * Cheapest per unit, not cheapest per pack: a 1kg bag at £1.20 beats a 300g
 * one at £0.80 for anyone cooking more than 300g, and it is the rate we are
 * after. Products whose size cannot be read, or is measured in something other
 * than the recipe's unit, tell us nothing about a rate and are skipped.
 */
export function unitPriceFrom(products: RetailerProduct[], ingredient: Ingredient): number | undefined {
  let best: number | undefined;

  for (const product of products) {
    const size = parsePackSize(product.size ? `${product.title} ${product.size}` : product.title);
    if (!size || size.unit !== ingredient.unit || size.qty <= 0) continue;
    const rate = product.price / size.qty;
    if (best === undefined || rate < best) best = rate;
  }

  return best;
}
