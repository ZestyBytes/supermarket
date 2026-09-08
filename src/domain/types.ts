/** Aisles as a UK supermarket lays them out. */
export type Aisle =
  | "produce"
  | "bakery"
  | "meat-fish"
  | "dairy"
  | "cupboard"
  | "frozen";

/** The three dimensions every quantity in the app reduces to. */
export type CanonicalUnit = "g" | "ml" | "each";

/** Units a recipe may be written in, before normalisation. */
export type RecipeUnit = CanonicalUnit | "kg" | "l" | "tbsp" | "tsp";

export interface Ingredient {
  id: string;
  name: string;
  /** Everything about this ingredient is measured in this unit internally. */
  unit: CanonicalUnit;
  aisle: Aisle;
  /** Staples most kitchens already hold; excluded from the list by default. */
  staple?: boolean;
  /** Shown when the unit is `each` but the thing is really a count of parts. */
  countNoun?: string;
}

export interface Product {
  id: string;
  ingredientId: string;
  name: string;
  /** Shelf description of the pack, e.g. "2.5kg" or "6 pack". */
  size: string;
  /** How much of the ingredient one pack contains, in the ingredient's unit. */
  packQty: number;
  price: number;
  /** Previous price, when the product is on offer. */
  was?: number;
  ownBrand?: boolean;
}

export interface RecipeIngredient {
  ingredientId: string;
  qty: number;
  unit: RecipeUnit;
  /** Free-text note shown in the recipe, e.g. "finely chopped". */
  prep?: string;
}

export interface Recipe {
  id: string;
  name: string;
  /** Servings the quantities above are written for. */
  serves: number;
  minutes: number;
  blurb: string;
  tags: string[];
  ingredients: RecipeIngredient[];
}

/** One meal chosen for the week, cooked for a given number of people. */
export interface PlannedMeal {
  /** Stable id so the same recipe can be planned twice. */
  key: string;
  recipeId: string;
  servings: number;
}

/** How much of one ingredient the whole plan needs, and which meals asked for it. */
export interface Requirement {
  ingredient: Ingredient;
  qty: number;
  unit: CanonicalUnit;
  sources: Array<{ recipeId: string; recipeName: string; qty: number }>;
}

/** A requirement resolved to a real product and a whole number of packs. */
export interface MatchedLine {
  requirement: Requirement;
  product: Product;
  /** Packs needed to cover the requirement. */
  packs: number;
  cost: number;
  /** Ingredient bought but not used by the plan, in the ingredient's unit. */
  surplus: number;
  /** Other products that could have covered it, cheapest first. */
  alternatives: Product[];
}
