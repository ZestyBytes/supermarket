import type { MatchedLine, Product, Requirement } from "./types";

export interface MatchOptions {
  /** Ingredients already in the cupboard; skipped entirely. */
  pantry?: ReadonlySet<string>;
  /** Shopper's own choice of product, by ingredient id, overriding the cheapest. */
  prefer?: Readonly<Record<string, string>>;
}

export interface MatchResult {
  lines: MatchedLine[];
  /** Requirements skipped because the ingredient is in the pantry. */
  skipped: Requirement[];
  /** Requirements no product in the catalogue can satisfy. */
  unmatched: Requirement[];
}

/**
 * Resolve each requirement to the product that covers it most cheaply.
 *
 * Buying is in whole packs, so the winner is the product with the lowest
 * total cost once rounded up; ties go to the pack that leaves the least
 * left over, which is what a shopper would actually pick.
 */
export function matchToProducts(
  requirements: Requirement[],
  products: Product[],
  options: MatchOptions = {},
): MatchResult {
  const pantry = options.pantry ?? new Set<string>();
  const byIngredient = new Map<string, Product[]>();
  for (const product of products) {
    const list = byIngredient.get(product.ingredientId);
    if (list) list.push(product);
    else byIngredient.set(product.ingredientId, [product]);
  }

  const lines: MatchedLine[] = [];
  const skipped: Requirement[] = [];
  const unmatched: Requirement[] = [];

  for (const requirement of requirements) {
    if (pantry.has(requirement.ingredient.id)) {
      skipped.push(requirement);
      continue;
    }
    const candidates = byIngredient.get(requirement.ingredient.id);
    if (!candidates || candidates.length === 0) {
      unmatched.push(requirement);
      continue;
    }

    const costed = candidates
      .map((product) => {
        const packs = packsFor(requirement.qty, product.packQty);
        const cost = round(packs * product.price);
        return { product, packs, cost, surplus: round(packs * product.packQty - requirement.qty) };
      })
      .sort((a, b) => a.cost - b.cost || a.surplus - b.surplus || a.product.price - b.product.price);

    const preferred = options.prefer?.[requirement.ingredient.id];
    const chosenIndex = preferred ? costed.findIndex((c) => c.product.id === preferred) : -1;
    const best = chosenIndex > -1 ? costed[chosenIndex] : costed[0];
    const rest = costed.filter((c) => c !== best);
    lines.push({
      requirement,
      product: best.product,
      packs: best.packs,
      cost: best.cost,
      surplus: best.surplus,
      alternatives: rest.map((c) => c.product),
    });
  }

  return { lines, skipped, unmatched };
}

/** Whole packs needed to cover a quantity, tolerant of floating-point drift. */
export function packsFor(needed: number, packQty: number): number {
  if (packQty <= 0) throw new Error("Pack quantity must be positive");
  if (needed <= 0) return 0;
  return Math.max(1, Math.ceil(needed / packQty - 1e-9));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
