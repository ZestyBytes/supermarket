import { useCallback, useEffect, useRef, useState } from "react";
import {
  addToBasket,
  getSession,
  readBasket,
  RetailerError,
  searchBatch,
  clearSearchCache,
  type RetailerBasket,
} from "../domain/retailerClient";
import { chooseLiveProducts, searchTermFor, swapChoice, type LiveMatch, type RetailerProduct } from "../domain/liveMatch";
import { broaderTermFor } from "../domain/broaden";
import { newAttemptId } from "../domain/ids";
import type { Requirement } from "../domain/types";

/** Where the whole thing is up to, in the order it happens. */
export type BasketPhase =
  | "connecting"
  | "offline"
  | "disconnected"
  | "ready"
  | "matching"
  | "armed"
  | "adding"
  | "added";

export interface ItemStatus {
  ingredientId: string;
  state: "checking" | "ready" | "missing" | "added" | "failed";
  product?: RetailerProduct;
  packs?: number;
  cost?: number;
  why?: string;
  /** Everything else Tesco offered, so a wrong pick can be corrected. */
  choices?: RetailerProduct[];
  /** The variety the recipe asked for, when a wider search found this instead. */
  instead?: string;
}

export interface BasketState {
  mode: 'live'|'mock';
  phase: BasketPhase;
  /** Set when we are connected: the moment we last read the basket. */
  connectedAt?: string;
  problem?: string;
  match: LiveMatch | null;
  /** One line per ingredient the week needs. */
  items: ItemStatus[];
  /** Things in the Tesco basket that this week's plan did not put there. */
  theirs: RetailerBasket["items"];
  total: number;
  estimated: number;
  progress: {done:number;total:number};
  add: () => void;
  recheck: () => void;
  /** Buy a different product for this ingredient. Ignored once it is bought. */
  swap: (ingredientId: string, productId: string) => void;
}

const NOTHING: RetailerBasket["items"] = [];

/**
 * Everything to do with Tesco, for the whole app.
 *
 * This used to be a page you visited: press find, wait, read, press add. But
 * none of that is a decision, it is work, and work belongs in the background.
 * The connection is checked before you pick anything, the products are matched
 * as soon as the plan changes, and all that is left for a person to do is say
 * yes once.
 */
export function useBasket(requirements: Requirement[]): BasketState {
  const [mode,setMode]=useState<'live'|'mock'>('live');
  const [phase, setPhase] = useState<BasketPhase>("connecting");
  const [connectionVersion,setConnectionVersion]=useState(0);
  const [progress,setProgress]=useState({done:0,total:0});
  const writing=useRef(false);
  const matchedKey=useRef('');
  const [connectedAt, setConnectedAt] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [basket, setBasket] = useState<RetailerBasket | null>(null);
  const [added, setAdded] = useState<Map<string, ItemStatus["state"]>>(new Map());
  const [failures, setFailures] = useState<Map<string, string>>(new Map());
  // Everything this app has put in the basket, kept for the life of the page.
  // Without it, changing the week after adding turns your own shopping into
  // "someone else put this here", which is a confusing thing to be told.
  const mine = useRef(new Set<string>());
  const attempt = useRef(newAttemptId());

  const key = requirements.map((r) => `${r.ingredient.id}:${r.qty}`).join("|");

  const connect = useCallback(async () => {
    if(writing.current)return;
    clearSearchCache();
    setPhase("connecting");
    setProblem(undefined);
    try {
      const { session, mode } = await getSession();
      setMode(mode);
      if (mode === "live" && !session.present) {
        setPhase("disconnected");
        return;
      }
      const live = await readBasket();
      setBasket(live);
      setConnectedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setPhase("ready");
      setConnectionVersion(v=>v+1);
    } catch (error) {
      const code = error instanceof RetailerError ? error.code : "RETAILER_ERROR";
      if (code === "OFFLINE") setPhase("offline");
      else if (code === "SESSION_EXPIRED" || code === "SESSION_MISSING") setPhase("disconnected");
      else {
        setProblem(error instanceof Error ? error.message : String(error));
        setPhase("disconnected");
      }
    }
  }, []);

  useEffect(() => {
    connect();
  }, [connect]);

  // Match whenever the week changes and we have somewhere to ask. Nobody
  // should have to press "find products": it is the same answer every time.
  useEffect(() => {
    if (!connectionVersion) return;
    if (requirements.length === 0) {
      setMatch(null);
      setPhase('ready');
      setProgress({done:0,total:0});
      return;
    }

    let cancelled = false;
    matchedKey.current='';
    setMatch(null);
    setPhase("matching");
    setProblem(undefined);
    setProgress({done:0,total:requirements.length});
    setAdded(new Map());
    setFailures(new Map());

    const timer=setTimeout(async () => {
      const found = new Map<string, RetailerProduct[]>();
      const failed = new Set<string>();
      try {
        for (let offset = 0; offset < requirements.length; offset += 4) {
          if (cancelled) return;
          const group = requirements.slice(offset, offset + 4);
          const answers = await searchBatch(group.map(searchTermFor));
          if(cancelled)return;
          for (const requirement of group) {
            const answer = answers.find((a) => a.query === searchTermFor(requirement));
            if (!answer || answer.error) failed.add(requirement.ingredient.id);
            found.set(requirement.ingredient.id, answer?.results ?? []);
          }
          const done=Math.min(offset+4,requirements.length);
          setProgress({done,total:requirements.length});
          setMatch(chooseLiveProducts(found,requirements.slice(0,done),failed));
        }
      } catch (error) {
        if (cancelled) return;
        setProblem(error instanceof Error ? error.message : String(error));
        setPhase("ready");
        return;
      }

      if (cancelled) return;
      const widened = new Set<string>();
      const empty = requirements.filter(
        (requirement) =>
          (found.get(requirement.ingredient.id)?.length ?? 0) === 0 &&
          !failed.has(requirement.ingredient.id) &&
          broaderTermFor(requirement),
      );

      if (empty.length > 0) {
        try {
          for (let offset = 0; offset < empty.length; offset += 4) {
            if (cancelled) return;
            const group = empty.slice(offset, offset + 4);
            const answers = await searchBatch(group.map((r) => broaderTermFor(r)!));
            if (cancelled) return;
            for (const requirement of group) {
              const answer = answers.find((a) => a.query === broaderTermFor(requirement));
              if (!answer || answer.error || answer.results.length === 0) continue;
              found.set(requirement.ingredient.id, answer.results);
              widened.add(requirement.ingredient.id);
            }
          }
        } catch {
          // The wider search is a second chance, not a requirement. Losing it
          // leaves the shop exactly as good as it was without it.
        }
      }

      if (cancelled) return;
      attempt.current = newAttemptId();
      matchedKey.current=key;
      setMatch(chooseLiveProducts(found, requirements, failed, widened));
      setPhase("armed");
    },180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, connectionVersion]);

  const swap = useCallback((ingredientId: string, productId: string) => {
    if(writing.current)return;
    setMatch((current) => {
      if (!current) return current;
      const choices = current.choices.map((choice) => {
        if (choice.requirement.ingredient.id !== ingredientId) return choice;
        const product = choice.candidates.find((candidate) => candidate.id === productId);
        return product ? swapChoice(choice, product) : choice;
      });
      return { ...current, choices };
    });
  }, []);

  const add = useCallback(async () => {
    if (!match || match.choices.length === 0 || writing.current || matchedKey.current!==key || phase!=='armed') return;
    writing.current=true;
    setPhase("adding");
    setProblem(undefined);
    try {
      const result = await addToBasket(
        match.choices.map((choice) => ({ productId: choice.product.id, qty: choice.packs })),
        attempt.current,
      );
      setBasket(result.basket);

      const wentIn = new Map<string, ItemStatus["state"]>();
      const why = new Map<string, string>();
      const held = new Map(result.basket.items.map((item) => [item.id, item.qty]));
      const refused = new Map(
        (result.failed as Array<{ productId: string; error?: { message?: string } }>).map((f) => [
          f.productId,
          f.error?.message ?? "Tesco did not confirm this line.",
        ]),
      );

      for (const choice of match.choices) {
        const ok = (result.added as Array<{productId:string}>).some(item=>item.productId===choice.product.id) && !refused.has(choice.product.id);
        wentIn.set(choice.requirement.ingredient.id, ok ? "added" : "failed");
        if (!ok) why.set(choice.requirement.ingredient.id, refused.get(choice.product.id) ?? "Not in the basket.");
      }

      for (const choice of match.choices) {
        if ((held.get(choice.product.id) ?? 0) > 0) mine.current.add(choice.product.id);
      }

      setAdded(wentIn);
      setFailures(why);
      setPhase("added");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setPhase("armed");
    } finally {writing.current=false;}
  }, [match,key,phase]);

  // One line per ingredient, in the order the list shows them.
  const items: ItemStatus[] = requirements.map((requirement) => {
    const id = requirement.ingredient.id;
    const choice = match?.choices.find((c) => c.requirement.ingredient.id === id);
    const missing = match?.review.some((r) => r.requirement.ingredient.id === id);
    const done = added.get(id);

    if (done) return { ingredientId: id, state: done, product: choice?.product, packs: choice?.packs, cost: choice?.cost, why: failures.get(id), instead: choice?.instead };
    if (missing) return { ingredientId: id, state: "missing" };
    if (choice) {
      return {
        ingredientId: id,
        state: "ready",
        product: choice.product,
        packs: choice.packs,
        cost: choice.cost,
        choices: phase==='armed'?choice.candidates:undefined,
        instead: choice.instead,
      };
    }
    return { ingredientId: id, state: "checking" };
  });

  const estimated = match?.choices.reduce((sum, choice) => sum + choice.cost, 0) ?? 0;

  const ours = new Set([...(match?.choices.map((c) => c.product.id) ?? []), ...mine.current]);
  const theirs = basket ? basket.items.filter((item) => !ours.has(item.id)) : NOTHING;

  return {
    mode,
    phase,
    connectedAt,
    problem,
    match,
    items,
    theirs,
    total: basket?.total ?? 0,
    estimated,
    progress,
    add,
    recheck: connect,
    swap,
  };
}
