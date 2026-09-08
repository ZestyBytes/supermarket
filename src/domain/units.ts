import type { CanonicalUnit, Ingredient, RecipeUnit } from "./types";

const TO_CANONICAL: Record<RecipeUnit, { unit: CanonicalUnit; factor: number }> = {
  g: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 },
  ml: { unit: "ml", factor: 1 },
  l: { unit: "ml", factor: 1000 },
  tbsp: { unit: "ml", factor: 15 },
  tsp: { unit: "ml", factor: 5 },
  each: { unit: "each", factor: 1 },
};

export class UnitMismatchError extends Error {
  constructor(unit: RecipeUnit, ingredient: Ingredient) {
    super(
      `Cannot measure ${ingredient.name} in ${unit}: it is counted in ${ingredient.unit}.`,
    );
    this.name = "UnitMismatchError";
  }
}

/** Convert a recipe quantity into the ingredient's own unit. */
export function toCanonical(qty: number, unit: RecipeUnit, ingredient: Ingredient): number {
  const conversion = TO_CANONICAL[unit];
  if (!conversion) throw new UnitMismatchError(unit, ingredient);
  if (conversion.unit !== ingredient.unit) throw new UnitMismatchError(unit, ingredient);
  return qty * conversion.factor;
}

/** Human-readable quantity: 1500g reads as 1.5kg, 3 onions as "3 onions". */
export function formatQty(qty: number, ingredient: Ingredient): string {
  const rounded = Math.round(qty * 100) / 100;
  if (ingredient.unit === "g") {
    return rounded >= 1000 ? `${trim(rounded / 1000)}kg` : `${trim(rounded)}g`;
  }
  if (ingredient.unit === "ml") {
    return rounded >= 1000 ? `${trim(rounded / 1000)} litres` : `${trim(rounded)}ml`;
  }
  const whole = Math.ceil(rounded - 1e-9);
  const noun = ingredient.countNoun ?? ingredient.name.toLowerCase();
  return `${whole} ${whole === 1 ? singular(noun) : plural(noun)}`;
}

/** Price per shelf unit, the way a shelf edge prints it. */
export function unitPrice(price: number, packQty: number, unit: CanonicalUnit): string {
  if (unit === "each") return `${money(price / packQty)} each`;
  const label = unit === "g" ? "kg" : "litre";
  const value = (price / packQty) * 1000;
  // Under a pound, a shelf edge prints pence rather than "£0.96".
  return value < 1 ? `${Math.round(value * 100)}p/${label}` : `${money(value)}/${label}`;
}

export function money(n: number): string {
  return `${n < 0 ? "-" : ""}£${Math.abs(n).toFixed(2)}`;
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}
function singular(noun: string): string {
  return noun.endsWith("es") ? noun.slice(0, -2) : noun.endsWith("s") ? noun.slice(0, -1) : noun;
}
function plural(noun: string): string {
  if (noun.endsWith("s")) return noun;
  if (/(ch|sh|x|o)$/.test(noun)) return `${noun}es`;
  return `${noun}s`;
}
