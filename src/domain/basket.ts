import type { MatchedLine, Product } from "./types";

export interface BasketLine {
  product: Product;
  qty: number;
  /** Where the line came from: the meal plan, or added by hand in the aisles. */
  source: "plan" | "manual";
}

export interface BasketTotals {
  items: number;
  goods: number;
  savings: number;
  delivery: number;
  total: number;
  /** Amount still to spend for free delivery, 0 once it is unlocked. */
  toFreeDelivery: number;
}

export const FREE_DELIVERY_OVER = 40;

export function totals(lines: BasketLine[], deliveryFee: number): BasketTotals {
  let items = 0;
  let goods = 0;
  let savings = 0;

  for (const line of lines) {
    items += line.qty;
    goods += line.product.price * line.qty;
    if (line.product.was) savings += (line.product.was - line.product.price) * line.qty;
  }

  goods = round(goods);
  const delivery = goods === 0 || goods >= FREE_DELIVERY_OVER ? 0 : deliveryFee;

  return {
    items,
    goods,
    savings: round(savings),
    delivery,
    total: round(goods + delivery),
    toFreeDelivery: Math.max(0, round(FREE_DELIVERY_OVER - goods)),
  };
}

/**
 * Fold the plan's matched lines into the basket.
 *
 * A product already in the basket is topped up to what the plan needs rather
 * than doubled — so pressing "add to basket" twice does not buy two weeks of
 * mince, and a manual purchase counts towards the plan.
 */
export function applyPlan(basket: BasketLine[], matched: MatchedLine[]): BasketLine[] {
  const next = basket.map((line) => ({ ...line }));

  for (const line of matched) {
    const existing = next.find((b) => b.product.id === line.product.id);
    if (existing) {
      existing.qty = Math.max(existing.qty, line.packs);
      existing.source = "plan";
    } else {
      next.push({ product: line.product, qty: line.packs, source: "plan" });
    }
  }

  return next;
}

/** How many packs of each planned product still need adding. */
export function outstanding(basket: BasketLine[], matched: MatchedLine[]): Map<string, number> {
  const held = new Map(basket.map((l) => [l.product.id, l.qty]));
  const gaps = new Map<string, number>();
  for (const line of matched) {
    const gap = line.packs - (held.get(line.product.id) ?? 0);
    if (gap > 0) gaps.set(line.product.id, gap);
  }
  return gaps;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
