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
}

export interface LiveReview {
  requirement: Requirement;
  /** Why this could not be decided automatically. */
  reason: "no-results" | "unreadable-size" | "wrong-unit" | "search-failed";
  candidates: RetailerProduct[];
}

export interface LiveMatch {
  choices: LiveChoice[];
  review: LiveReview[];
}

/**
 * Turn live search results into a decision, or into a question.
 *
 * A retailer writes the pack size into the product title and nowhere else, so
 * a title we cannot parse means we do not know how much food a pack holds.
 * That line goes to review rather than being assumed to be enough — buying one
 * pack of an unknown size is how a week's plan quietly comes up short.
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
      const anyUnreadable = candidates.some((product) => !parsePackSize(product.title));
      review.push({
        requirement,
        reason: anyUnreadable ? "unreadable-size" : "wrong-unit",
        candidates,
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

/** The search term to send for an ingredient. Deliberately plain — retailers match words. */
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
 * unchanged plan asks first — a repeated request must not silently buy the
 * week twice.
 */
export function submissionFingerprint(choices: LiveChoice[]): string {
  return choices
    .map((choice) => `${choice.product.id}:${choice.packs}`)
    .sort()
    .join("|");
}
