import { describe, expect, it } from "vitest";
import { formatQty, money, toCanonical, unitPrice, UnitMismatchError } from "../units";
import type { Ingredient } from "../types";

const potato: Ingredient = { id: "potato", name: "Potatoes", unit: "g", aisle: "produce" };
const oil: Ingredient = { id: "olive-oil", name: "Olive oil", unit: "ml", aisle: "cupboard" };
const onion: Ingredient = { id: "onion", name: "Onions", unit: "each", aisle: "produce" };
const garlic: Ingredient = { ...onion, id: "garlic", name: "Garlic", countNoun: "clove" };
it.each([['Limes','1 lime'],['Sausages','1 sausage'],['Tomatoes','1 tomato'],['Stock cubes','1 stock cube']])('formats a single %s without truncating its name',(name,result)=>{
 expect(formatQty(1,{...onion,name})).toBe(result);
});

describe("toCanonical", () => {
  it("converts kilos to grams", () => {
    expect(toCanonical(1.2, "kg", potato)).toBe(1200);
  });

  it("converts spoons to millilitres", () => {
    expect(toCanonical(2, "tbsp", oil)).toBe(30);
    expect(toCanonical(3, "tsp", oil)).toBe(15);
  });

  it("leaves counts alone", () => {
    expect(toCanonical(3, "each", onion)).toBe(3);
  });

  it("refuses to measure a counted ingredient by weight", () => {
    expect(() => toCanonical(500, "g", onion)).toThrow(UnitMismatchError);
  });

  it("refuses to measure a weighed ingredient by volume", () => {
    expect(() => toCanonical(1, "l", potato)).toThrow(/counted in g/);
  });
});

describe("formatQty", () => {
  it("promotes grams to kilos past 1000", () => {
    expect(formatQty(1500, potato)).toBe("1.5kg");
    expect(formatQty(900, potato)).toBe("900g");
  });

  it("promotes millilitres to litres past 1000", () => {
    expect(formatQty(1200, oil)).toBe("1.2 litres");
  });

  it("rounds counted things up to whole items", () => {
    expect(formatQty(2.5, onion)).toBe("3 onions");
    expect(formatQty(1, onion)).toBe("1 onion");
  });

  it("uses the counting noun where the ingredient has one", () => {
    expect(formatQty(3, garlic)).toBe("3 cloves");
    expect(formatQty(1, garlic)).toBe("1 clove");
  });
});

describe("unitPrice", () => {
  it("prices weight per kilo", () => {
    expect(unitPrice(2.4, 2500, "g")).toBe("96p/kg");
    expect(unitPrice(5.25, 650, "g")).toBe("£8.08/kg");
  });

  it("prices volume per litre", () => {
    expect(unitPrice(1.35, 1136, "ml")).toBe("£1.19/litre");
  });

  it("prices counted packs per item", () => {
    expect(unitPrice(2.2, 6, "each")).toBe("£0.37 each");
  });
});

describe("money", () => {
  it("always shows two decimals", () => {
    expect(money(4)).toBe("£4.00");
    expect(money(-1.5)).toBe("-£1.50");
  });
});
