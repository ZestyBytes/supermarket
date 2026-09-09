import { describe, expect, it } from "vitest";
import { broaderTermFor } from "../broaden";
import { chooseLiveProducts, swapChoice, type RetailerProduct } from "../liveMatch";
import type { Requirement } from "../types";

function need(id: string, name: string, qty = 300): Requirement {
  return {
    ingredient: { id, name, unit: "g", aisle: "produce" },
    qty,
    unit: "g",
    sources: [{ recipeId: "r", recipeName: "Stew", qty }],
  } as Requirement;
}

describe("broaderTermFor", () => {
  it("widens a variety to the thing itself", () => {
    expect(broaderTermFor(need("mushroom", "Chestnut mushrooms"))).toBe("mushrooms");
    expect(broaderTermFor(need("spinach", "Baby spinach"))).toBe("spinach");
    expect(broaderTermFor(need("broccoli", "Tenderstem broccoli"))).toBe("broccoli");
  });

  it("refuses to widen where the wider thing is a different food", () => {
    // Whole chickens, whole lambs and whole salmon are not what was asked for.
    expect(broaderTermFor(need("chicken-breast", "Chicken breast"))).toBeUndefined();
    expect(broaderTermFor(need("lamb-mince", "Lamb mince"))).toBeUndefined();
    expect(broaderTermFor(need("butter", "Salted butter"))).toBeUndefined();
  });

  it("says nothing when it would ask Tesco the same question twice", () => {
    expect(broaderTermFor(need("spinach", "Spinach"))).toBeUndefined();
  });
});

describe("a match made from the wider search", () => {
  const mushrooms: RetailerProduct[] = [{ id: "m1", title: "Tesco White Mushrooms 300G", price: 1.1 }];
  const requirement = need("mushroom", "Chestnut mushrooms");

  it("says what it bought instead", () => {
    const match = chooseLiveProducts(
      new Map([["mushroom", mushrooms]]),
      [requirement],
      new Set(),
      new Set(["mushroom"]),
    );
    expect(match.choices[0].product.title).toContain("White Mushrooms");
    expect(match.choices[0].instead).toBe("Chestnut mushrooms");
  });

  it("says nothing when the exact variety was what turned up", () => {
    const match = chooseLiveProducts(new Map([["mushroom", [{id:'chestnut',title:'Chestnut Mushrooms 300G',price:1.5}]]]), [requirement]);
    expect(match.choices[0].instead).toBeUndefined();
  });
  it('prefers the requested variety and rejects mushroom soup',()=>{
    const match=chooseLiveProducts(new Map([['mushroom',[...mushrooms,{id:'soup',title:'Mushroom Soup 400G',price:.2},{id:'exact',title:'Chestnut Mushrooms 300G',price:2}]]]),[requirement]);
    expect(match.choices[0].product.id).toBe('exact');
    expect(match.choices[0].candidates.some(p=>p.id==='soup')).toBe(false);
  });
  it('notes a different variety even when the exact search returned it',()=>{
    expect(chooseLiveProducts(new Map([['mushroom',mushrooms]]),[requirement]).choices[0].instead).toBe('Chestnut mushrooms');
  });
  it('does not buy a prepared dish when no plain ingredient was returned',()=>{
    expect(chooseLiveProducts(new Map([['mushroom',[{id:'soup',title:'Mushroom Soup 400G',price:.5}]]]),[requirement]).choices).toHaveLength(0);
  });
});

it('updates the variety note when the person changes products',()=>{
 const requirement=need('mushroom','Chestnut mushrooms');
 const exact={id:'exact',title:'Chestnut Mushrooms 300G',price:2};
 const white={id:'white',title:'White Mushrooms 300G',price:1};
 const choice=chooseLiveProducts(new Map([['mushroom',[exact,white]]]),[requirement]).choices[0];
 expect(swapChoice(choice,white).instead).toBe('Chestnut mushrooms');
 expect(swapChoice(swapChoice(choice,white),exact).instead).toBeUndefined();
});
