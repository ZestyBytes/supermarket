import { describe, expect, it } from "vitest";
import { mealProgress } from "../mealProgress";
import type { Requirement } from "../types";

function needs(...ids: string[]): Requirement[] {
  return ids.map((id) => ({
    ingredient: { id, name: id, unit: "g", aisle: "produce" },
    qty: 1,
    unit: "g",
    sources: [{ recipeId: "curry", recipeName: "Curry", qty: 1 }],
  })) as Requirement[];
}

const from = (map: Record<string, string>) => (id: string) => map[id] as never;

describe("how far a meal has got into the basket", () => {
  it("is working while any of its shopping is still on its way", () => {
    expect(mealProgress("curry", needs("a", "b"), from({ a: "added", b: "ready" }))).toBe("working");
  });

  it("is in once all of it is there", () => {
    expect(mealProgress("curry", needs("a", "b"), from({ a: "added", b: "added" }))).toBe("in");
  });

  it("is short when Tesco had nothing for part of it", () => {
    expect(mealProgress("curry", needs("a", "b"), from({ a: "added", b: "missing" }))).toBe("short");
  });

  it("does not wait for something already in the cupboard", () => {
    // Ticked off the list, so it is not in the requirements at all, and a meal
    // whose every other line is bought must not spin forever waiting for it.
    expect(mealProgress("curry", needs("a"), from({ a: "added" }))).toBe("in");
  });

  it("says nothing about a meal that is not in the week", () => {
    expect(mealProgress("pie", needs("a"), from({ a: "added" }))).toBe("none");
  });

  it("waits rather than guessing while the ingredients are unknown", () => {
    expect(mealProgress("curry", needs("a", "b"), from({ a: "checking", b: "checking" }))).toBe("working");
  });
});
