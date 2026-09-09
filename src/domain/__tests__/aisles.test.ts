import { describe, expect, it } from "vitest";
import { byAisle } from "../aisles";
import type { Aisle, Requirement } from "../types";

function requirement(name: string, aisle: Aisle): Requirement {
  return {
    ingredient: { id: name.toLowerCase(), name, unit: "g", aisle },
    qty: 100,
    unit: "g",
    sources: [],
  };
}

describe("byAisle", () => {
  it("walks the shop in order, fresh first and frozen last", () => {
    const groups = byAisle([
      requirement("Peas", "frozen"),
      requirement("Rice", "cupboard"),
      requirement("Mince", "meat-fish"),
      requirement("Onions", "produce"),
      requirement("Milk", "dairy"),
    ]);
    expect(groups.map((g) => g.name)).toEqual([
      "Fruit & veg",
      "Meat & fish",
      "Dairy & chilled",
      "Cupboard",
      "Frozen",
    ]);
  });

  it("leaves out aisles with nothing in them", () => {
    const groups = byAisle([requirement("Onions", "produce")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].ingredient.name).toBe("Onions");
  });

  it("sorts within an aisle so the same list reads the same way twice", () => {
    const groups = byAisle([
      requirement("Onions", "produce"),
      requirement("Apples", "produce"),
      requirement("Carrots", "produce"),
    ]);
    expect(groups[0].items.map((i) => i.ingredient.name)).toEqual(["Apples", "Carrots", "Onions"]);
  });

  it("is empty for an empty week", () => {
    expect(byAisle([])).toEqual([]);
  });
});
