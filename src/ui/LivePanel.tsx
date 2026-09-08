import { useEffect, useRef, useState } from "react";
import {
  addToBasket,
  getSession,
  readBasket,
  RetailerError,
  searchBatch,
  type RetailerBasket,
  type SessionState,
} from "../domain/retailerClient";
import {
  chooseLiveProducts,
  searchTermFor,
  submissionFingerprint,
  type LiveMatch,
  type RetailerProduct,
} from "../domain/liveMatch";
import { formatQty, money } from "../domain/units";
import type { Requirement } from "../domain/types";

interface Props {
  /** What the week needs, after consolidation and cupboard exclusions. */
  requirements: Requirement[];
}

type Stage = "idle" | "searching" | "matched" | "sending" | "sent";

const LAST_SEND_KEY = "supermarket.lastSend";

export function LivePanel({ requirements }: Props) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [mode, setMode] = useState<"live" | "mock">("live");
  const [stage, setStage] = useState<Stage>("idle");
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [basket, setBasket] = useState<RetailerBasket | null>(null);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const [progress, setProgress] = useState("");
  const attemptId = useRef(crypto.randomUUID());

  useEffect(() => {
    refreshSession();
  }, []);

  async function refreshSession() {
    try {
      const state = await getSession();
      setSession(state.session);
      setMode(state.mode);
      setProblem(null);
    } catch (error) {
      setSession(null);
      report(error);
    }
  }

  function report(error: unknown) {
    if (error instanceof RetailerError) setProblem({ code: error.code, message: error.message });
    else setProblem({ code: "RETAILER_ERROR", message: String(error) });
  }

  async function findProducts() {
    setStage("searching");
    setProblem(null);
    const found = new Map<string, RetailerProduct[]>();
    const failures = new Set<string>();

    setProgress(`Finding products for ${requirements.length} ingredients…`);
    try {
      for (let offset = 0; offset < requirements.length; offset += 4) {
        const group = requirements.slice(offset, offset + 4);
        const results = await searchBatch(group.map(searchTermFor));
        for (const requirement of group) {
          const result = results.find(r => r.query === searchTermFor(requirement));
          if (!result || result.error) failures.add(requirement.ingredient.id);
          found.set(requirement.ingredient.id, result?.results ?? []);
        }
        setProgress(`Searched ${Math.min(offset + 4, requirements.length)} of ${requirements.length} ingredients…`);
      }
      attemptId.current = crypto.randomUUID();
    } catch (error) { report(error); setStage("idle"); setProgress(""); return; }

    setProgress("");
    setMatch(chooseLiveProducts(found, requirements, failures));
    setStage("matched");
  }

  async function send() {
    if (!match) return;
    const fingerprint = submissionFingerprint(match.choices);
    const previous = readLastSend();

    if (previous?.fingerprint === fingerprint) {
      const when = new Date(previous.at).toLocaleTimeString();
      const again = window.confirm(
        `This exact list was already added at ${when}. Adding it again will double those items in your basket. Continue?`,
      );
      if (!again) return;
    }

    setStage("sending");
    setProblem(null);
    try {
      const result = await addToBasket(
        match.choices.map((choice) => ({ productId: choice.product.id, qty: choice.packs })),
        attemptId.current,
      );
      setBasket(result.basket);
      writeLastSend(fingerprint);
      setStage("sent");
      if (result.failed.length > 0) {
        setProblem({ code: "PARTIAL", message: `${result.failed.length} line(s) were not added. See your basket.` });
      }
    } catch (error) {
      report(error);
      setStage("matched");
    }
  }

  async function verify() {
    try {
      setBasket(await readBasket());
      setProblem(null);
    } catch (error) {
      report(error);
    }
  }

  const estimated = match?.choices.reduce((sum, choice) => sum + choice.cost, 0) ?? 0;

  function replaceProduct(ingredientId: string, productId: string) {
    if (!match) return;
    const current = match.choices.find(c => c.requirement.ingredient.id === ingredientId);
    if (!current) return;
    const candidates = [current.product, ...current.alternatives];
    const product = candidates.find(p => p.id === productId);
    if (!product) return;
    const replacement = chooseLiveProducts(new Map([[ingredientId, [product]]]), [current.requirement]).choices[0];
    if (!replacement) return;
    replacement.alternatives = candidates.filter(p => p.id !== productId);
    setMatch({ ...match, choices: match.choices.map(c => c === current ? replacement : c) });
    attemptId.current = crypto.randomUUID();
    setStage('matched');
  }

  return (
    <section className="card retailer" aria-labelledby="live-head">
      <div className="card__head">
        <h2 id="live-head">Your real basket</h2>
        <span className="label">{mode === "mock" ? "Mock retailer" : "Live"}</span>
      </div>

      <div className="card__body retailer__body">
        <SessionRow session={session} mode={mode} onRefresh={refreshSession} />

        {problem && (
          <p className={`notice notice--${problem.code === "PARTIAL" ? "warn" : "bad"}`}>
            <strong>{labelFor(problem.code)}</strong> {problem.message}
            {problem.code === "SESSION_EXPIRED" && (
              <span className="notice__how"> Run <code>npm run connect</code>, click Connect in the Supermarket Tesco Connect Chrome extension, then refresh your Tesco basket.</span>
            )}
          </p>
        )}

        {stage === "searching" && <p className="retailer__progress">{progress}</p>}

        {match && stage !== "idle" && (
          <>
            <ul className="retailer__lines">
              {match.choices.map((choice) => (
                <li className="retailer__line" key={choice.requirement.ingredient.id}>
                  <span className="retailer__name">{choice.product.title}</span>
                  <span className="retailer__packs">
                    {choice.packs} × {money(choice.product.price)}
                  </span>
                  <span className="retailer__need">
                    for {formatQty(choice.requirement.qty, choice.requirement.ingredient)}
                    {choice.surplus > 0 && ` · ${formatQty(choice.surplus, choice.requirement.ingredient)} spare`}
                  </span>
                  {choice.alternatives.length > 0 && <label className="retailer__need">Change product for {choice.requirement.ingredient.name}
                    <select aria-label={`Tesco product for ${choice.requirement.ingredient.name}`} value={choice.product.id} disabled={stage === 'sending' || stage === 'sent'} onChange={e => replaceProduct(choice.requirement.ingredient.id, e.target.value)}>
                      {[choice.product, ...choice.alternatives].map(p => <option key={p.id} value={p.id}>{p.title} — {money(p.price)}</option>)}
                    </select>
                  </label>}
                </li>
              ))}
            </ul>

            {match.review.length > 0 && (
              <div className="retailer__review">
                <p className="label">
                  {match.review.length} ingredients need a match
                </p>
                <ul>
                  {match.review.map((item) => (
                    <li key={item.requirement.ingredient.id}>
                      <strong>{item.requirement.ingredient.name}</strong> — {reasonFor(item.reason)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="retailer__sum">
              {match.choices.length} lines · about {money(estimated)} at listed prices
            </p>
          </>
        )}

        {basket && (
          <div className="retailer__basket">
            <p className="label">Read back from the retailer</p>
            <ul>
              {basket.items.map((item) => (
                <li key={item.id}>
                  {item.qty} × {item.title}
                </li>
              ))}
              {basket.items.length === 0 && <li>Basket is empty.</li>}
            </ul>
            <p className="retailer__total">
              Retailer total <strong>{money(basket.total)}</strong>
              <span className="retailer__caveat">
                Their figure, not ours — it includes delivery, offers and anything already in the basket.
              </span>
            </p>
          </div>
        )}

        <div className="retailer__acts">
          <button
            className="btn"
            type="button"
            onClick={findProducts}
            disabled={requirements.length === 0 || stage === "searching" || stage === "sending"}
          >
            {stage === "searching" ? "Searching…" : "Find live products"}
          </button>
          <button
            className="btn btn--go"
            type="button"
            onClick={send}
            disabled={!match || match.review.length > 0 || match.choices.length === 0 || stage !== "matched"}
          >
            {stage === "sending" ? "Adding…" : `Add ${match?.choices.length ?? 0} lines to my basket`}
          </button>
          <button className="mini" type="button" onClick={verify}>
            Read my basket
          </button>
        </div>

        <p className="retailer__note">
          Nothing is ever checked out or paid for. The session stays on this machine — the page asks
          the local server, and only that server talks to the retailer.
        </p>
      </div>
    </section>
  );
}

function SessionRow({
  session,
  mode,
  onRefresh,
}: {
  session: SessionState | null;
  mode: "live" | "mock";
  onRefresh: () => void;
}) {
  if (mode === "mock") {
    return <p className="retailer__session">Running against the built-in mock shop. No real account is involved.</p>;
  }
  if (!session?.present) {
    return (
      <p className="retailer__session retailer__session--off">
        Run <code>npm run connect</code>, open the Supermarket Tesco Connect extension in your usual Chrome, and click Connect. Then refresh Tesco. No cookie copying needed.
      </p>
    );
  }
  return (
    <p className="retailer__session">
      Session imported {session.ageHours != null && session.ageHours < 48 ? `${session.ageHours}h ago` : "a while ago"}
      .{" "}
      <button className="mini" type="button" onClick={onRefresh}>
        Re-check
      </button>
    </p>
  );
}

function labelFor(code: string): string {
  switch (code) {
    case "SESSION_EXPIRED":
      return "Signed out.";
    case "SESSION_MISSING":
      return "No session.";
    case "OFFLINE":
      return "Local server not running.";
    case "NOT_CONFIGURED":
      return "Retailer not configured.";
    case "RATE_LIMITED":
      return "Too fast.";
    case "PARTIAL":
      return "Partly added.";
    default:
      return "Retailer problem.";
  }
}

function reasonFor(reason: "no-results" | "unreadable-size" | "wrong-unit" | "search-failed"): string {
  switch (reason) {
    case 'search-failed': return 'Tesco search failed temporarily. Click Find live products to retry.';
    case "no-results":
      return "nothing came back from search";
    case "unreadable-size":
      return "the pack size is not written in the product title, so we cannot tell how much a pack holds";
    case "wrong-unit":
      return "the packs are sold by a different measure than the recipe asks for";
  }
}

function readLastSend(): { fingerprint: string; at: string } | null {
  try {
    const raw = window.localStorage.getItem(LAST_SEND_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLastSend(fingerprint: string) {
  try {
    window.localStorage.setItem(LAST_SEND_KEY, JSON.stringify({ fingerprint, at: new Date().toISOString() }));
  } catch {
    /* storage unavailable */
  }
}
