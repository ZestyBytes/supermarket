import type { LiveChoice } from "./liveMatch";
import type { RetailerBasket } from "./retailerClient";

export interface LineStatus {
  ingredientName: string;
  productTitle: string;
  wanted: number;
  inBasket: number;
  state: "in" | "short" | "missing";
  why?: string;
}

export interface Reconciliation {
  lines: LineStatus[];
  /** Everything on our list that the basket now holds in full. */
  done: number;
  /** Ours that are missing or short: the ones worth looking at. */
  problems: LineStatus[];
  /** Things in the basket that were nothing to do with this week's plan. */
  othersInBasket: number;
}

/**
 * Check the basket against the list we meant to add, line by line.
 *
 * What was sent is not evidence; what Tesco says it holds is. And the basket
 * is not ours alone. Someone else in the house adds to it too, so the
 * question is never "what is in the basket" but "is everything we asked for
 * in it". Their items are counted and otherwise left alone.
 */
export function reconcile(
  choices: LiveChoice[],
  basket: RetailerBasket,
  failures: Array<{ productId: string; error?: { message?: string } }> = [],
): Reconciliation {
  const held = new Map(basket.items.map((item) => [item.id, item]));
  const reason = new Map(failures.map((failure) => [failure.productId, failure.error?.message]));

  const lines = choices.map((choice) => {
    const inBasket = held.get(choice.product.id)?.qty ?? 0;
    const wanted = choice.packs;
    return {
      ingredientName: choice.requirement.ingredient.name,
      productTitle: choice.product.title,
      wanted,
      inBasket,
      state: inBasket >= wanted ? "in" : inBasket > 0 ? "short" : "missing",
      why: reason.get(choice.product.id),
    } satisfies LineStatus;
  });

  const ours = new Set(choices.map((choice) => choice.product.id));

  return {
    lines,
    done: lines.filter((line) => line.state === "in").length,
    problems: lines.filter((line) => line.state !== "in"),
    othersInBasket: basket.items.filter((item) => !ours.has(item.id)).length,
  };
}
