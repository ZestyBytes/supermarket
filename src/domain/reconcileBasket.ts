import type { LiveMatch } from "./liveMatch";
import type { RetailerBasket } from "./retailerClient";

export interface BasketChange {
  /** Products to set to a quantity, absolute rather than added on top. */
  set: Array<{ productId: string; qty: number }>;
  /** Products of ours to take out entirely. */
  remove: string[];
}

/**
 * What would have to change for the basket to match the week.
 *
 * Adding a meal, removing one, ticking something off as already in the
 * cupboard, cooking for two more people: four things a person does, and one
 * thing the basket needs, which is to end up holding what the plan says. Four
 * event handlers would be four chances to disagree with each other. This
 * compares the two states and reports the difference, so there is only ever
 * one answer to be wrong about.
 *
 * `ours` is what this app put in. Nothing outside it is ever proposed for
 * removal, so shopping someone else added is untouchable here by construction
 * rather than by remembering to check.
 */
export function reconcileBasket(
  match: LiveMatch | null,
  basket: RetailerBasket | null,
  ours: ReadonlySet<string>,
): BasketChange {
  const wanted = new Map<string, number>();
  for (const choice of match?.choices ?? []) {
    wanted.set(choice.product.id, (wanted.get(choice.product.id) ?? 0) + choice.packs);
  }

  const held = new Map((basket?.items ?? []).map((item) => [item.id, item.qty]));

  const set: BasketChange["set"] = [];
  for (const [productId, qty] of wanted) {
    if (held.get(productId) !== qty) set.push({ productId, qty });
  }

  const remove: string[] = [];
  for (const productId of held.keys()) {
    if (!wanted.has(productId) && ours.has(productId)) remove.push(productId);
  }

  return { set, remove };
}

/** Nothing to do, so nothing should be sent. */
export function settled(change: BasketChange): boolean {
  return change.set.length === 0 && change.remove.length === 0;
}
