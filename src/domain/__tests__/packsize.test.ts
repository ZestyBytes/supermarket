import { describe, expect, it } from "vitest";
import { parsePackSize } from "../packsize";

describe("parsePackSize", () => {
  it("reads weights out of a retailer title", () => {
    expect(parsePackSize("Chicken Breast Fillets 320G")).toMatchObject({ qty: 320, unit: "g" });
    expect(parsePackSize("Chicken Breast Fillets 1Kg")).toMatchObject({ qty: 1000, unit: "g" });
    expect(parsePackSize("Maris Piper Potatoes 2.5Kg")).toMatchObject({ qty: 2500, unit: "g" });
  });

  it("reads volumes", () => {
    expect(parsePackSize("Semi Skimmed Milk 2.27L")).toMatchObject({ qty: 2270, unit: "ml" });
    expect(parsePackSize("Coconut Milk 400Ml")).toMatchObject({ qty: 400, unit: "ml" });
  });

  it("multiplies out a multipack rather than reading one unit", () => {
    expect(parsePackSize("Chopped Tomatoes 4 X 400G")).toMatchObject({ qty: 1600, unit: "g" });
    expect(parsePackSize("Sparkling Water 6 x 500ml")).toMatchObject({ qty: 3000, unit: "ml" });
  });

  it("reads counted packs", () => {
    expect(parsePackSize("Brown Onions 3 Pack")).toMatchObject({ qty: 3, unit: "each" });
    expect(parsePackSize("Free Range Eggs 12 Pack")).toMatchObject({ qty: 12, unit: "each" });
  });

  it("returns null when the size is not in the title", () => {
    // The important case: a null here must send the line to review, never be
    // treated as one pack being enough food.
    expect(parsePackSize("Seasonal Vegetable Selection")).toBeNull();
    expect(parsePackSize("")).toBeNull();
  });

  it("shows which part of the title it read", () => {
    expect(parsePackSize("Beef Mince 5% Fat 500G")?.matched).toBe("500G");
  });
});
