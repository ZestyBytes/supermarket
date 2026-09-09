import { useEffect, useState } from "react";
import { getSession, searchBatch, RetailerError } from "../domain/retailerClient";
import { checkOrder, type Stock } from "../domain/stock";
import { searchTermFor } from "../domain/liveMatch";
import type { Ingredient, Recipe } from "../domain/types";

/** How many ingredients to ask about in one request. The server batches inside this. */
const GROUP = 8;

export interface StockState {
  stock: Stock;
  /** Ingredients answered so far, out of the whole catalogue. */
  done: number;
  total: number;
  running: boolean;
  /** Set when there is no point trying: no server, or Tesco not connected. */
  off: boolean;
}

/**
 * Ask Tesco about every ingredient in the catalogue, quietly, in the
 * background, while you are choosing dinners.
 *
 * Whether a meal can actually be shopped is the most useful thing to know
 * while picking it, and it was only discoverable at the end by pressing a
 * button and waiting. The answers are the same for everyone every week, so
 * this starts as soon as the app opens and fills the cards in as it goes,
 * most-shared ingredients first.
 *
 * It stops at the first sign there is nothing to talk to, so a hosted copy or
 * a disconnected session costs one request, not ninety.
 */
export function useStock(recipes: Recipe[], ingredients: Ingredient[]): StockState {
  const [state, setState] = useState<StockState>({
    stock: new Map(),
    done: 0,
    total: 0,
    running: false,
    off: false,
  });
  // No "have I already started?" guard here. React runs an effect twice in
  // development to catch exactly this sort of thing, and a guard like that
  // lets the FIRST run proceed and then cancels it, while the second returns
  // early, so nothing happens at all, in development only. Each run instead
  // owns its own cancelled flag; the searches are cached server-side, so a
  // repeat costs nothing.
  useEffect(() => {
    let cancelled = false;
    const order = checkOrder(recipes);

    (async () => {
      try {
        const { session, mode } = await getSession();
        if (mode === "live" && !session.present) {
          setState((s) => ({ ...s, off: true }));
          return;
        }
      } catch {
        // No local server, so this copy cannot ask, and saying so once is enough.
        setState((s) => ({ ...s, off: true }));
        return;
      }

      if (cancelled) return;
      setState((s) => ({ ...s, running: true, total: order.length }));

      const stock: Stock = new Map();

      for (let offset = 0; offset < order.length; offset += GROUP) {
        if (cancelled) return;
        const group = order.slice(offset, offset + GROUP);
        const terms = group.map((id) => termFor(id, ingredients));

        try {
          const answers = await searchBatch(terms);
          for (const [index, id] of group.entries()) {
            const answer = answers.find((a) => a.query === terms[index]);
            // A failed search is not an answer; leave it unknown and move on.
            if (!answer || answer.error) continue;
            stock.set(id, answer.results.length > 0 ? "yes" : "no");
          }
        } catch (error) {
          if (error instanceof RetailerError && (error.code === "OFFLINE" || error.code === "SESSION_EXPIRED")) {
            if (!cancelled) setState((s) => ({ ...s, running: false, off: true }));
            return;
          }
          // Anything else is this group's problem, not the whole catalogue's.
        }

        if (!cancelled) {
          setState((s) => ({ ...s, stock: new Map(stock), done: stock.size, running: true }));
        }
      }

      if (!cancelled) setState((s) => ({ ...s, running: false }));
    })();

    return () => {
      cancelled = true;
    };
  }, [recipes, ingredients]);

  return state;
}

/**
 * Reuse the shopping search term, so what we ask here is exactly what the
 * shop will ask later, because otherwise a meal could read as available and then
 * fail at the till.
 */
function termFor(ingredientId: string, ingredients: Ingredient[]): string {
  const ingredient = ingredients.find((i) => i.id === ingredientId);
  if (!ingredient) return ingredientId.replace(/-/g, " ");
  return searchTermFor({ ingredient, qty: 1, unit: ingredient.unit, sources: [] });
}
