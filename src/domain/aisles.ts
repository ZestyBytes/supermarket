import type { Aisle, Requirement } from "./types";

export interface AisleGroup {
  aisle: Aisle;
  name: string;
  items: Requirement[];
}

/**
 * Aisles in the order a UK supermarket walks you through them, which is also
 * the order you want a list in: fresh first, freezer last so it is not sitting
 * in the trolley thawing.
 */
const ORDER: Array<[Aisle, string]> = [
  ["produce", "Fruit & veg"],
  ["bakery", "Bakery"],
  ["meat-fish", "Meat & fish"],
  ["dairy", "Dairy & chilled"],
  ["cupboard", "Cupboard"],
  ["frozen", "Frozen"],
];

/**
 * Group the week's shopping the way it is actually collected.
 *
 * One alphabetical list means walking the shop twice. Every ingredient
 * already carries an aisle, so the grouping costs nothing and turns the list
 * into something you can follow end to end.
 */
export function byAisle(requirements: Requirement[]): AisleGroup[] {
  return ORDER.map(([aisle, name]) => ({
    aisle,
    name,
    items: requirements
      .filter((requirement) => requirement.ingredient.aisle === aisle)
      .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name)),
  })).filter((group) => group.items.length > 0);
}
