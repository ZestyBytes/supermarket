import { useCallback, useEffect, useRef, useState } from "react";
import {
  addToBasket,
  removeFromBasket,
  getSession,
  readBasket,
  RetailerError,
  searchBatch,
  clearSearchCache,
  type RetailerBasket,
} from "../domain/retailerClient";
import { chooseLiveProducts, searchTermFor, swapChoice, type LiveMatch, type RetailerProduct } from "../domain/liveMatch";
import { broaderTermFor } from "../domain/broaden";
import { reconcileBasket, settled } from "../domain/reconcileBasket";
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
  recheck: () => void;
  /** Buy a different product for this ingredient. Ignored once it is bought. */
  swap: (ingredientId: string, productId: string) => void;
  /** Empty the Tesco basket completely, including what this app did not add. */
  empty: () => Promise<void>;
  /** How many of this week's lines are in the basket now. */
  inBasket: number;
  /** True while the basket is being brought in line with the week. */
  syncing: boolean;
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
  const [failures, setFailures] = useState<Map<string, string>>(new Map());
  const [syncing, setSyncing] = useState(false);
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

  /**
   * Put lines back, and forget we ever added them.
   *
   * The removal is the easy half. The bookkeeping matters more: `mine` is what
   * stops the app calling your own shopping someone else's, so anything taken
   * out has to leave it, or the line would reappear under "already in your
   * basket" the moment the week changed.
   */
  const unwind = useCallback(async (productIds?: string[]) => {
    setPhase("adding");
    setProblem(undefined);
    try {
      const result = await removeFromBasket(newAttemptId(), productIds);
      setBasket(result.basket);
      const gone = new Set(result.basket.items.map((item) => item.id));
      for (const id of mine.current) if (!gone.has(id)) mine.current.delete(id);
      setPhase("armed");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setPhase("added");
    }
  }, [match]);

  const empty = useCallback(async () => {
    await unwind(undefined);
  }, [unwind]);

  /**
   * Keep the basket in step with the week, without being asked.
   *
   * Picking a meal already meant "I want to cook this", and pressing a button
   * afterwards to say it again was a second decision standing in for no new
   * information. So the basket follows the plan: choose a dinner and its
   * shopping goes in, drop one and it comes out, tick something off as already
   * in the cupboard and it comes out too.
   *
   * The wait before acting is the point. Someone choosing five dinners taps
   * five times in a few seconds, and writing to Tesco on each tap is both
   * twenty-odd needless writes and the surest way to be told to slow down.
   * Waiting for the picking to stop turns all of it into one round.
   */
  const sync = useCallback(async () => {
    const change = reconcileBasket(match, basket, mine.current);
    if (settled(change)) return;

    setSyncing(true);
    setProblem(undefined);
    try {
      let latest = basket;

      if (change.set.length > 0) {
        const result = await addToBasket(change.set, newAttemptId(), true);
        latest = result.basket;
        const held = new Map(result.basket.items.map((item) => [item.id, item.qty]));
        for (const line of change.set) if ((held.get(line.productId) ?? 0) > 0) mine.current.add(line.productId);
      }

      if (change.remove.length > 0) {
        const result = await removeFromBasket(newAttemptId(), change.remove);
        latest = result.basket;
        const still = new Set(result.basket.items.map((item) => item.id));
        for (const id of change.remove) if (!still.has(id)) mine.current.delete(id);
      }

      if (latest) setBasket(latest);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
    }
  }, [match, basket]);

  // Act once the picking stops, not on every tap.
  useEffect(() => {
    // "ready" belongs here as much as "armed" does. Taking the last dinner out
    // of the week, or ticking off the last thing on the list, leaves nothing to
    // match and so never reaches "armed": without this the shopping for a week
    // you have cancelled sits in the basket forever.
    if (phase !== "armed" && phase !== "added" && phase !== "ready") return;
    if (settled(reconcileBasket(match, basket, mine.current))) return;
    const timer = setTimeout(() => { void sync(); }, 1400);
    return () => clearTimeout(timer);
  }, [phase, match, basket, sync]);


  // One line per ingredient, in the order the list shows them.
  const held = new Map((basket?.items ?? []).map((item) => [item.id, item.qty]));

  // Where each line has got to, read off the basket rather than remembered.
  // A note of what we once sent can disagree with what Tesco actually holds;
  // the basket cannot.
  const items: ItemStatus[] = requirements.map((requirement) => {
    const id = requirement.ingredient.id;
    const choice = match?.choices.find((c) => c.requirement.ingredient.id === id);
    const missing = match?.review.some((r) => r.requirement.ingredient.id === id);

    if (missing) return { ingredientId: id, state: "missing" };
    if (!choice) return { ingredientId: id, state: "checking" };

    const inBasket = held.get(choice.product.id) ?? 0;
    const common = { product: choice.product, packs: choice.packs, cost: choice.cost, instead: choice.instead };

    if (inBasket >= choice.packs) return { ingredientId: id, state: "added", ...common };
    if (failures.has(id)) return { ingredientId: id, state: "failed", why: failures.get(id), ...common };
    return { ingredientId: id, state: "ready", ...common, choices: choice.candidates };
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
    recheck: connect,
    swap,
    empty,
    inBasket: items.filter((item) => item.state === "added").length,
    syncing,
  };
}
