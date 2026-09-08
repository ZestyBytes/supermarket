import { describe, expect, it } from "vitest";
import { chooseLiveProducts, searchTermFor, submissionFingerprint, type RetailerProduct } from "../liveMatch";
import type { Ingredient, Requirement } from "../types";

const chicken: Ingredient = { id: "chicken-breast", name: "Chicken breast", unit: "g", aisle: "meat-fish" };
const onion: Ingredient = { id: "onion", name: "Onions", unit: "each", aisle: "produce" };

function need(ingredient: Ingredient, qty: number): Requirement {
  return { ingredient, qty, unit: ingredient.unit, sources: [{ recipeId: "r", recipeName: "Test", qty }] };
}

const CHICKEN: RetailerProduct[] = [
  { id: "t-320", title: "Chicken Breast Fillets 320G", price: 2.44 },
  { id: "t-650", title: "Chicken Breast Fillets 650G", price: 4.9 },
  { id: "t-1kg", title: "Chicken Breast Fillets 1Kg", price: 6.69 },
];

describe("chooseLiveProducts", () => {
  it('keeps failed searches distinct from no products', () => {
    const result = chooseLiveProducts(new Map(), [need(chicken, 600)], new Set(['chicken-breast']));
    expect(result.review[0].reason).toBe('search-failed');
  });
  it('does not substitute ready cooked rice for dry rice', () => {
    const rice: Ingredient = { id: 'rice', name: 'Basmati rice', unit: 'g', aisle: 'cupboard' };
    const result = chooseLiveProducts(new Map([['rice', [{id:'ready',title:'Microwave Basmati Rice 250g',price:0.5},{id:'dry',title:'Basmati Rice 1Kg',price:1.79}]]]), [need(rice,300)]);
    expect(result.choices[0].product.id).toBe('dry');
  });
  it('counts peppers sold Each without inventing a weight conversion', () => {
    const pepper: Ingredient = {id:'pepper',name:'Peppers',unit:'each',aisle:'produce'};
    const result=chooseLiveProducts(new Map([['pepper',[{id:'p',title:'Tesco Red Peppers Each',price:0.7}]]]),[need(pepper,3)]);
    expect(result.choices[0].packs).toBe(3);
  });
  it('rejects ginger yoghurt and selects fresh ginger with a known weight', () => {
    const ginger: Ingredient = {id:'ginger',name:'Root ginger',unit:'g',aisle:'produce'};
    const result=chooseLiveProducts(new Map([['ginger',[{id:'y',title:'Ginger Yogurt 150g',price:0.5},{id:'g',title:'Tesco Ginger 100g',price:1.25}]]]),[need(ginger,20)]);
    expect(result.choices[0].product.id).toBe('g');
  });
  it("picks the cheapest way to cover the need in whole packs", () => {
    // 600g: one 650g pack at £4.90 beats two 320g packs at £4.88? No — £4.88 is
    // cheaper, and two packs is what a shopper would actually buy.
    const { choices } = chooseLiveProducts(new Map([["chicken-breast", CHICKEN]]), [need(chicken, 600)]);
    expect(choices[0].product.id).toBe("t-320");
    expect(choices[0].packs).toBe(2);
    expect(choices[0].cost).toBe(4.88);
    expect(choices[0].surplus).toBe(40);
  });

  it("scales up to the big pack when the week needs it", () => {
    const { choices } = chooseLiveProducts(new Map([["chicken-breast", CHICKEN]]), [need(chicken, 1800)]);
    expect(choices[0].packs * choices[0].packQty).toBeGreaterThanOrEqual(1800);
    expect(choices[0].cost).toBeLessThanOrEqual(6.69 * 2);
  });

  it("sends a product with an unreadable size to review instead of buying one", () => {
    const results = new Map([["chicken-breast", [{ id: "x", title: "Chicken Selection", price: 3 }]]]);
    const { choices, review } = chooseLiveProducts(results, [need(chicken, 600)]);
    expect(choices).toHaveLength(0);
    expect(review[0].reason).toBe("unreadable-size");
  });

  it("refuses to count grams against something sold by the item", () => {
    const results = new Map([["onion", [{ id: "o", title: "Brown Onions 1Kg", price: 1.45 }]]]);
    const { choices, review } = chooseLiveProducts(results, [need(onion, 6)]);
    expect(choices).toHaveLength(0);
    expect(review[0].reason).toBe("wrong-unit");
  });

  it("reports an empty search rather than skipping the ingredient", () => {
    const { review } = chooseLiveProducts(new Map([["chicken-breast", []]]), [need(chicken, 600)]);
    expect(review[0].reason).toBe("no-results");
  });

  it("keeps the runners-up so the choice can be changed", () => {
    const { choices } = chooseLiveProducts(new Map([["chicken-breast", CHICKEN]]), [need(chicken, 600)]);
    expect(choices[0].alternatives.length).toBe(2);
  });
});

describe("searchTermFor", () => {
  it("sends plain words, without the qualifier after a comma", () => {
    expect(searchTermFor(need({ ...chicken, name: "Beef mince, 5% fat" }, 500))).toBe("Beef mince");
  });
});

describe("submissionFingerprint", () => {
  it("is stable regardless of line order", () => {
    const a = [{ product: { id: "a" }, packs: 1 }, { product: { id: "b" }, packs: 2 }];
    const b = [{ product: { id: "b" }, packs: 2 }, { product: { id: "a" }, packs: 1 }];
    expect(submissionFingerprint(a as never)).toBe(submissionFingerprint(b as never));
  });

  it("changes when a quantity changes, so a re-send is not mistaken for a repeat", () => {
    const a = [{ product: { id: "a" }, packs: 1 }];
    const b = [{ product: { id: "a" }, packs: 2 }];
    expect(submissionFingerprint(a as never)).not.toBe(submissionFingerprint(b as never));
  });
});
