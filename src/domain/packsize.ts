import type { CanonicalUnit } from "./types";

export interface PackSize {
  qty: number;
  unit: CanonicalUnit;
  /** The part of the title the size was read from, for showing your working. */
  matched: string;
}

const MULTIPACK = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\b/i;
const WEIGHT = /(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\b/i;
const COUNT = /(\d+)\s*(?:pack|pk|s\b)?\s*$/i;
const EXPLICIT_COUNT = /(?:^|\s)(\d+)\s*(?:pack|pk)\b/i;

const SCALE: Record<string, { unit: CanonicalUnit; factor: number }> = {
  kg: { unit: "g", factor: 1000 },
  g: { unit: "g", factor: 1 },
  l: { unit: "ml", factor: 1000 },
  cl: { unit: "ml", factor: 10 },
  ml: { unit: "ml", factor: 1 },
};

/**
 * Read the pack size out of a retailer's product title.
 *
 * Retailers write the size into the title rather than a field — "Chicken
 * Breast Fillets 650G", "Chopped Tomatoes 4 X 400G", "Brown Onions 3 Pack".
 * When nothing parses, this returns null: the caller must flag the line for
 * review rather than assume one pack is enough food.
 */
export function parsePackSize(title: string): PackSize | null {
  if (!title) return null;
  if (/\beach\s*$/i.test(title)) return { qty: 1, unit: 'each', matched: 'Each' };

  // "4 x 400g" is 1600g, not 4 packs and not 400g.
  const multi = MULTIPACK.exec(title);
  if (multi) {
    const scale = SCALE[multi[3].toLowerCase()];
    return {
      qty: Number(multi[1]) * Number(multi[2]) * scale.factor,
      unit: scale.unit,
      matched: multi[0],
    };
  }

  const weight = WEIGHT.exec(title);
  if (weight) {
    const scale = SCALE[weight[2].toLowerCase()];
    return { qty: Number(weight[1]) * scale.factor, unit: scale.unit, matched: weight[0] };
  }

  const explicit = EXPLICIT_COUNT.exec(title);
  if (explicit) return { qty: Number(explicit[1]), unit: "each", matched: explicit[0].trim() };

  const trailing = COUNT.exec(title.trim());
  if (trailing) return { qty: Number(trailing[1]), unit: "each", matched: trailing[0].trim() };

  return null;
}
