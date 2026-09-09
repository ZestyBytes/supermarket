import { parsePackSize } from "./packsize";
import { packsFor } from "./match";
import type { Requirement } from "./types";

/** A product as a retailer's search returns it. */
export interface RetailerProduct {
  id: string;
  title: string;
  price: number;
  size?: string;
  url?: string;
}

export interface LiveChoice {
  requirement: Requirement;
  product: RetailerProduct;
  packQty: number;
  packs: number;
  cost: number;
  surplus: number;
  alternatives: RetailerProduct[];
  /**
   * Set when the pack maths could not be done exactly and one pack was taken
   * as enough: the title did not say a size, or said it in a different
   * measure than the recipe. Worth showing quietly; not worth refusing over.
   */
  assumed?: "size" | "unit";
}

export interface LiveReview {
  requirement: Requirement;
  /**
   * Why nothing could be chosen. Both remaining reasons mean Tesco returned
   * nothing usable, and a pack we cannot measure is still a pack we can buy, so
   * that is no longer a reason to leave an ingredient out.
   */
  reason: "no-results" | "search-failed";
  candidates: RetailerProduct[];
}

export interface LiveMatch {
  choices: LiveChoice[];
  review: LiveReview[];
}

/**
 * Turn live search results into a decision.
 *
 * Where the pack size is written in the title we can do the maths properly and
 * buy exactly enough. Where it is not, or where it is written in a different
 * measure than the recipe, we take one pack and say so.
 *
 * Refusing those was the wrong call. "Peppers, sold by a different measure" is
 * not a shop that cannot be done; it is a pepper. Leaving it out to be exact
 * meant coming home without it, which is the failure that actually matters.
 * The only thing that still counts as unavailable is Tesco having nothing.
 */
export function chooseLiveProducts(
  results: Map<string, RetailerProduct[]>,
  requirements: Requirement[],
  failures: Set<string> = new Set(),
): LiveMatch {
  const choices: LiveChoice[] = [];
  const review: LiveReview[] = [];

  for (const requirement of requirements) {
    if (failures.has(requirement.ingredient.id)) {
      review.push({ requirement, reason: 'search-failed', candidates: [] });
      continue;
    }
    const candidates = results.get(requirement.ingredient.id) ?? [];
    if (candidates.length === 0) {
      review.push({ requirement, reason: "no-results", candidates });
      continue;
    }

    const costed = candidates
      .filter(product => relevantProduct(requirement.ingredient.id, product.title))
      .map((product) => {
        const size = parsePackSize(product.size ? `${product.title} ${product.size}` : product.title);
        if (!size) return { product, problem: "unreadable-size" as const };
        if (size.unit !== requirement.unit) return { product, problem: "wrong-unit" as const };
        const packs = packsFor(requirement.qty, size.qty);
        return {
          product,
          packQty: size.qty,
          packs,
          cost: Math.round(packs * product.price * 100) / 100,
          surplus: Math.round((packs * size.qty - requirement.qty) * 100) / 100,
        };
      })
      .filter((entry): entry is Extract<typeof entry, { packs: number }> => "packs" in entry)
      .sort((a, b) => a.cost - b.cost || a.surplus - b.surplus);

    if (costed.length === 0) {
      // Nothing we could measure, so buy the cheapest sensible one and move on.
      const relevant = candidates.filter((product) => relevantProduct(requirement.ingredient.id, product.title));
      const usable = (relevant.length > 0 ? relevant : candidates).slice().sort((a, b) => a.price - b.price);
      const [pick, ...others] = usable;
      const readable = parsePackSize(pick.size ? `${pick.title} ${pick.size}` : pick.title);

      choices.push({
        requirement,
        product: pick,
        packQty: readable?.qty ?? requirement.qty,
        packs: 1,
        cost: Math.round(pick.price * 100) / 100,
        surplus: 0,
        alternatives: others,
        assumed: readable ? "unit" : "size",
      });
      continue;
    }

    const [best, ...rest] = costed;
    choices.push({
      requirement,
      product: best.product,
      packQty: best.packQty,
      packs: best.packs,
      cost: best.cost,
      surplus: best.surplus,
      alternatives: rest.map((entry) => entry.product),
    });
  }

  return { choices, review };
}

/** The search term to send for an ingredient. Deliberately plain, because retailers match words. */
export function searchTermFor(requirement: Requirement): string {
  const terms: Record<string, string> = { 'beef-mince': 'beef mince 5% fat', 'chicken-thigh': 'chicken thigh fillets', rice: 'basmati rice 1kg', tortilla: 'plain tortilla wraps', ginger: 'ginger', pepper: 'peppers', peas: 'frozen garden peas', lemon: 'lemons pack', lime: 'limes pack' };
  if (terms[requirement.ingredient.id]) return terms[requirement.ingredient.id];
  return requirement.ingredient.name.replace(/,.*$/, "").trim();
}

function relevantProduct(id: string, title: string): boolean {
  const exclusions: Record<string, RegExp> = {
    rice: /microwave|ready|cooked|pouch|boil in|wholegrain|brown/i,
    'chicken-breast': /cooked|roast|breaded|battered|nugget|sliced|kiev|southern|goujon/i,
    'chicken-thigh': /bone.in|drumstick|skin.on/i,
    tortilla: /mini|kit|chips|pocket/i,
    potato: /mashed|roast|chips|fries|croquette|dauphinoise|crisps/i,
    carrot: /baton|cake|juice|mash/i,
    salmon: /smoked|paste|spread|en.croute/i,
    ginger: /ground|beer|biscuit|paste|syrup|yogurt|yoghurt|puree|crushed|crystallised|lazy|shot|tea|aperitif/i,
    peas: /water|sweetcorn|split|soup/i,
    pepper: /mini|sliced|frozen|towel|wax|black|ground/i,
    lemon: /juice|curd|cake|drink/i,
    lime: /juice|cordial|pickle|drink/i,
  };
  if (id === 'beef-mince' && !/5\s*%/.test(title)) return false;
  return !exclusions[id]?.test(title);
}

/**
 * A stable fingerprint of what a submission would send.
 *
 * Recorded after a successful add so that pressing the button again on an
 * unchanged plan asks first: a repeated request must not silently buy the
 * week twice.
 */
export function submissionFingerprint(choices: LiveChoice[]): string {
  return choices
    .map((choice) => `${choice.product.id}:${choice.packs}`)
    .sort()
    .join("|");
}
