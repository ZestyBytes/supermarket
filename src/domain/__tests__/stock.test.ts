import { describe, expect, it } from "vitest";
import { checkOrder, ingredientsToCheck, mealStock, type Stock } from "../stock";
import type { Ingredient, Recipe } from "../types";

const ingredients: Ingredient[] = [
  { id: "onion", name: "Onions", unit: "each", aisle: "produce" },
  { id: "mince", name: "Beef mince", unit: "g", aisle: "meat-fish" },
  { id: "saffron", name: "Saffron", unit: "g", aisle: "cupboard" },
];

function recipe(id: string, ids: string[]): Recipe {
  return {
    id,
    name: id,
    serves: 4,
    minutes: 30,
    blurb: "",
    tags: [],
    emoji: "",
    ingredients: ids.map((ingredientId) => ({ ingredientId, qty: 1, unit: "each" as const })),
  };
}

const stock = (entries: Array<[string, "yes" | "no"]>): Stock => new Map(entries);

describe("mealStock", () => {
  it("is ready once every ingredient has come back available", () => {
    const result = mealStock(recipe("bol", ["onion", "mince"]), stock([["onion", "yes"], ["mince", "yes"]]), ingredients);
    expect(result.state).toBe("ready");
    expect(result.missing).toEqual([]);
  });

  it("is short as soon as one is missing, and names it", () => {
    const result = mealStock(recipe("paella", ["onion", "saffron"]), stock([["onion", "yes"], ["saffron", "no"]]), ingredients);
    expect(result.state).toBe("short");
    expect(result.missing).toEqual(["Saffron"]);
  });

  // An amber flag on an ingredient nobody has asked about yet is a lie.
  it("stays unknown while some of the meal is still unchecked", () => {
    const result = mealStock(recipe("bol", ["onion", "mince"]), stock([["onion", "yes"]]), ingredients);
    expect(result.state).toBe("unknown");
    expect(result.checked).toBe(1);
    expect(result.total).toBe(2);
  });

  it("says short even when the rest is unchecked — one miss is enough to know", () => {
    const result = mealStock(recipe("paella", ["onion", "saffron"]), stock([["saffron", "no"]]), ingredients);
    expect(result.state).toBe("short");
  });

  it("is unknown before anything has been asked", () => {
    expect(mealStock(recipe("bol", ["onion"]), new Map(), ingredients).state).toBe("unknown");
  });
});

describe("ingredientsToCheck", () => {
  it("asks about each ingredient once, however many meals share it", () => {
    const list = ingredientsToCheck([recipe("a", ["onion", "mince"]), recipe("b", ["onion", "saffron"])]);
    expect(list.sort()).toEqual(["mince", "onion", "saffron"]);
  });
});

describe("checkOrder", () => {
  it("asks about the most-shared ingredients first, so the grid settles soonest", () => {
    const order = checkOrder([
      recipe("a", ["onion", "mince"]),
      recipe("b", ["onion", "saffron"]),
      recipe("c", ["onion"]),
    ]);
    expect(order[0]).toBe("onion");
  });
});
