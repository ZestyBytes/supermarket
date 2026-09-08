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
import { newAttemptId } from "../domain/ids";

interface Props {
  /** What the week needs, after consolidation and cupboard exclusions. */
  requirements: Requirement[];
}

type Stage = "idle" | "searching" | "matched" | "sending" | "sent";

const LAST_SEND_KEY = "supermarket.lastSend";

/** The setup step, in one place: three different failures all end here. */
const CONNECT_HOW =
  "On the computer running the app: run npm run connect, open the Supermarket Tesco Connect extension in your usual Chrome, and click Connect.";

/** What the last real call to the retailer proved, rather than what we assume. */
type Connection =
  | { state: "unknown" }
  | { state: "checking" }
  | { state: "live"; at: string; items: number }
  | { state: "failed"; code: string; message: string };

export function LivePanel({ requirements }: Props) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [mode, setMode] = useState<"live" | "mock">("live");
  const [stage, setStage] = useState<Stage>("idle");
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [basket, setBasket] = useState<RetailerBasket | null>(null);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const [progress, setProgress] = useState("");
  const [reach, setReach] = useState<"checking" | "ok" | "absent">("checking");
  const [conn, setConn] = useState<Connection>({ state: "unknown" });
  const attemptId = useRef(newAttemptId());

  useEffect(() => {
    refreshSession();
  }, []);

  async function refreshSession() {
    try {
      const state = await getSession();
      setSession(state.session);
      setMode(state.mode);
      setProblem(null);
      setReach("ok");
      // A session file on disk proves nothing about whether the retailer still
      // accepts it. Ask them.
      if (state.session.present || state.mode === "mock") checkConnection();
    } catch (error) {
      setSession(null);
      // Nothing answering at all is a different thing from a retailer saying
      // no, and only one of them means this copy can never work. A phone on
      // the same WiFi as the server reaches it fine, so this is the answer to
      // trust rather than what the address bar says.
      if (error instanceof RetailerError && error.code === "OFFLINE") {
        setReach("absent");
        return;
      }
      setReach("ok");
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
      attemptId.current = newAttemptId();
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

  /**
   * The one question worth answering on a phone: is this actually talking to
   * Tesco right now?
   *
   * Reading the basket is the only honest way to know. A stored session, a
   * cookie count, an "imported 2h ago" — none of them survive the retailer
   * rotating the session, and all of them look identical whether it worked or
   * not. Reading the basket back exercises the session, the config and the
   * network in one go, and changes nothing.
   */
  async function checkConnection() {
    setConn({ state: "checking" });
    try {
      const live = await readBasket();
      setBasket(live);
      setProblem(null);
      setConn({
        state: "live",
        at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        items: live.items.length,
      });
    } catch (error) {
      const code = error instanceof RetailerError ? error.code : "RETAILER_ERROR";
      const message = error instanceof Error ? error.message : String(error);
      if (code === "OFFLINE") setReach("absent");
      setConn({ state: "failed", code, message });
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
    attemptId.current = newAttemptId();
    setStage('matched');
  }

  if (reach === "absent") return <PlanningOnly />;

  return (
    <section className="card retailer" aria-labelledby="live-head">
      <div className="card__head">
        <h2 id="live-head">Your real basket</h2>
        <span className="label">{mode === "mock" ? "Mock retailer" : "Live"}</span>
      </div>

      <div className="card__body retailer__body">
        <ConnectionRow conn={conn} session={session} mode={mode} onCheck={checkConnection} />

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
        </div>

        <p className="retailer__note">
          Nothing is ever checked out or paid for. The session stays on this machine — the page asks
          the local server, and only that server talks to the retailer.
        </p>
      </div>
    </section>
  );
}

/**
 * What the panel becomes on a static build — a hosted preview, or a phone.
 *
 * Offering buttons here would be dishonest: the session is a file on one
 * machine and there is no way for this page to reach it. Better to say so than
 * to let someone tap "Add to my basket" and get a shrug.
 */
function PlanningOnly() {
  return (
    <section className="card retailer" aria-labelledby="live-head">
      <div className="card__head">
        <h2 id="live-head">Your real basket</h2>
        <span className="label">Planning only</span>
      </div>
      <div className="card__body retailer__body">
        <p className="notice">
          <strong>No local server answered.</strong> Adding to a real Tesco basket needs the small
          server that holds your session, and nothing is listening for this page. Everything else
          here — the meals, the consolidated list, the quantities and totals — works in full.
        </p>
        <p className="retailer__note">
          On a hosted copy there is nothing to reach: your session stays on your own machine, which
          is exactly why it cannot follow the app onto the web. To shop for real, run{" "}
          <code>npm run server</code> and <code>npm run dev -- --host</code> on that machine, then
          open its address from your phone on the same WiFi.
        </p>
      </div>
    </section>
  );
}

function ConnectionRow({
  conn,
  session,
  mode,
  onCheck,
}: {
  conn: Connection;
  session: SessionState | null;
  mode: "live" | "mock";
  onCheck: () => void;
}) {
  const what = describe(conn, session, mode);
  return (
    <div className={`conn conn--${what.tone}`}>
      <p className="conn__state">
        <span className="conn__dot" aria-hidden="true" />
        <strong>{what.headline}</strong>
      </p>
      <p className="conn__detail">{what.detail}</p>
      <button className="mini" type="button" onClick={onCheck} disabled={conn.state === "checking"}>
        {conn.state === "checking" ? "Checking…" : "Check again"}
      </button>
    </div>
  );
}

/**
 * Says what is true, in the words someone standing in a kitchen would use.
 * Every branch names the next move, because "not connected" without "here is
 * what to do" is just a wall.
 */
function describe(
  conn: Connection,
  session: SessionState | null,
  mode: "live" | "mock",
): { tone: "good" | "bad" | "wait"; headline: string; detail: string } {
  if (mode === "mock") {
    return {
      tone: "wait",
      headline: "Practice shop",
      detail: "Running against the built-in mock shop. No real Tesco account is involved.",
    };
  }
  if (conn.state === "checking") {
    return { tone: "wait", headline: "Checking Tesco…", detail: "Reading your basket to see whether the session still works." };
  }
  if (conn.state === "live") {
    return {
      tone: "good",
      headline: "Connected to Tesco",
      detail: `Read your basket at ${conn.at} — ${conn.items === 0 ? "it is empty" : `${conn.items} item${conn.items === 1 ? "" : "s"} in it`}. Anything you add will go here.`,
    };
  }
  if (conn.state === "failed") {
    if (conn.code === "SESSION_EXPIRED") {
      return {
        tone: "bad",
        headline: "Not connected — Tesco signed you out",
        detail: `Tesco ended the session. ${CONNECT_HOW}`,
      };
    }
    if (conn.code === "SESSION_MISSING") {
      return {
        tone: "bad",
        headline: "Not connected — no Tesco session yet",
        detail: CONNECT_HOW,
      };
    }
    if (conn.code === "NOT_CONFIGURED" || conn.code === "UNSAFE_CONFIG") {
      return {
        tone: "bad",
        headline: "Not connected — Tesco is not set up",
        detail: "The app does not yet know which Tesco requests to make. See docs/live-basket.md on the computer running it.",
      };
    }
    return { tone: "bad", headline: "Not connected", detail: conn.message };
  }
  if (!session?.present) {
    return {
      tone: "bad",
      headline: "Not connected — no Tesco session yet",
      detail: CONNECT_HOW,
    };
  }
  return { tone: "wait", headline: "Not checked yet", detail: "Tap Check again to see whether Tesco still accepts the session." };
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
    case "UNSAFE_CONFIG":
      return "Unsafe configuration.";
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
