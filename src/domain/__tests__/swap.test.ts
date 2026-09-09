import { describe, expect, it } from "vitest";
import { chooseLiveProducts, swapChoice, type RetailerProduct } from "../liveMatch";
import type { Requirement } from "../types";

const onions: Requirement = {
  ingredient: { id: "onions", name: "Onions", unit: "g", aisle: "produce" },
  qty: 600,
  unit: "g",
  sources: [{ recipeId: "curry", recipeName: "Curry", qty: 600 }],
} as Requirement;

const shelf: RetailerProduct[] = [
  { id: "p1", title: "Tesco Onions 1Kg", price: 1.2 },
  { id: "p2", title: "Tesco Onions 500G", price: 0.8 },
  { id: "p3", title: "Onion Gravy Granules 200G", price: 1.5 },
];

describe("swapChoice", () => {
  const match = chooseLiveProducts(new Map([["onions", shelf]]), [onions]);
  const chosen = match.choices[0];

  it("offers every result, including the ones the filter rejected", () => {
    // The right answer is often exactly what our own relevance filter binned.
    expect(chosen.candidates.map((c) => c.id).sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("does the pack maths again around the product a person picked", () => {
    const swapped = swapChoice(chosen, shelf[1]);
    expect(swapped.product.id).toBe("p2");
    expect(swapped.packs).toBe(2);
    expect(swapped.cost).toBe(1.6);
    expect(swapped.surplus).toBe(400);
  });

  it("takes one pack when the swap cannot be measured against the recipe", () => {
    const odd: RetailerProduct = { id: "p9", title: "Onions, loose", price: 0.35 };
    const swapped = swapChoice({ ...chosen, candidates: [...shelf, odd] }, odd);
    expect(swapped.packs).toBe(1);
    expect(swapped.cost).toBe(0.35);
    expect(swapped.assumed).toBe("size");
  });

  it("keeps the full list so you can change your mind again", () => {
    const once = swapChoice(chosen, shelf[2]);
    const back = swapChoice(once, shelf[0]);
    expect(back.product.id).toBe("p1");
    expect(back.candidates).toHaveLength(3);
  });

  it("leaves the chosen product out of the alternatives", () => {
    const swapped = swapChoice(chosen, shelf[2]);
    expect(swapped.alternatives.map((a) => a.id)).not.toContain("p3");
  });
});
