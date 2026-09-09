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
import { mealsAtRisk, reasonText } from "../domain/availability";
import { reconcile, type Reconciliation } from "../domain/reconcile";
import { Icon } from "./Icon";

interface Props {
  /** What the week needs, after consolidation and cupboard exclusions. */
  requirements: Requirement[];
}

type Stage = "idle" | "searching" | "matched" | "sending" | "sent";

const LAST_SEND_KEY = "supermarket.lastSend";

/** The setup step, in one place: three different failures all end here. */
const CONNECT_HOW =
  "On the computer running the app: open the Supermarket extension in Chrome, click Connect, then refresh your Tesco tab.";

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
  const [failures, setFailures] = useState<Array<{ productId: string; error?: { message?: string } }>>([]);

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
      for (let offset = 0; offset < requirements.length; offset += 8) {
        const group = requirements.slice(offset, offset + 8);
        const results = await searchBatch(group.map(searchTermFor));
        for (const requirement of group) {
          const result = results.find(r => r.query === searchTermFor(requirement));
          if (!result || result.error) failures.add(requirement.ingredient.id);
          found.set(requirement.ingredient.id, result?.results ?? []);
        }
        setProgress(`Checked ${Math.min(offset + 8, requirements.length)} of ${requirements.length} with Tesco…`);
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
      setFailures(result.failed as Array<{ productId: string; error?: { message?: string } }>);
      writeLastSend(fingerprint);
      setStage("sent");
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
    <>
      <header className="top">
        <div>
          <h1 className="top__title">Your Tesco basket</h1>
          <p className="top__sub">{mode === "mock" ? "Practice shop — no real account" : "Matched to real products"}</p>
        </div>
      </header>

      <main className="sheet">
        <ConnectionRow conn={conn} session={session} mode={mode} onCheck={checkConnection} />

        {problem && (
          <p className="notice notice--bad">
            <b>{labelFor(problem.code)}</b> {problem.message}
            {problem.code === "SESSION_EXPIRED" && ` ${CONNECT_HOW}`}
          </p>
        )}

        {stage === "searching" && <p className="progressline">{progress}</p>}

        {stage === "sent" && basket && match ? (
          <Outcome check={reconcile(match.choices, basket, failures)} total={basket.total} />
        ) : (
          match &&
          stage !== "idle" && (
            <>
              {match.review.length > 0 && <AtRisk match={match} />}

              <div className="sectionhead">
                <span className="label">Matched at Tesco</span>
                <span className="aisle__n">
                  {match.choices.length} of {match.choices.length + match.review.length}
                </span>
              </div>

              <ul className="rows">
                {match.choices.map((choice) => (
                  <li className="row" key={choice.requirement.ingredient.id}>
                    <div className="row__what">
                      <span className="row__title">{choice.product.title}</span>
                      <span className="row__covers">
                        covers {formatQty(choice.requirement.qty, choice.requirement.ingredient)}{" "}
                        {choice.requirement.ingredient.name.toLowerCase()}
                        {choice.requirement.sources.length > 1 && ` · ${choice.requirement.sources.length} meals`}
                      </span>
                      {choice.alternatives.length > 0 && (
                        <select
                          aria-label={`Tesco product for ${choice.requirement.ingredient.name}`}
                          value={choice.product.id}
                          disabled={stage === "sending"}
                          onChange={(e) => replaceProduct(choice.requirement.ingredient.id, e.target.value)}
                        >
                          {[choice.product, ...choice.alternatives].map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.title} — {money(product.price)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="row__cost">
                      <span className="row__price">{money(choice.cost)}</span>
                      <span className="row__packs">
                        {choice.packs} pack{choice.packs === 1 ? "" : "s"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )
        )}

        <div className="act">
          {stage === "sent" ? (
            <button className="go" type="button" onClick={findProducts}>
              Check Tesco again
            </button>
          ) : match ? (
            <button
              className="go"
              type="button"
              onClick={send}
              disabled={match.choices.length === 0 || stage !== "matched"}
            >
              {stage === "sending" ? "Adding…" : `Add ${match.choices.length} items to Tesco`}
              {stage === "matched" && <span className="go__note">{money(estimated)}</span>}
            </button>
          ) : (
            <button
              className="go"
              type="button"
              onClick={findProducts}
              disabled={requirements.length === 0 || stage === "searching"}
            >
              {stage === "searching" ? "Checking Tesco…" : "Find these at Tesco"}
            </button>
          )}
          <p className="act__foot">Nothing is ordered or paid for — you check out at Tesco</p>
        </div>
      </main>
    </>
  );
}

/**
 * What the panel becomes on a static build — a hosted preview, or a phone
 * away from home.
 *
 * Offering buttons here would be dishonest: the session is a file on one
 * machine and there is no way for this page to reach it. Better to say so
 * than to let someone tap "Add to Tesco" and get a shrug.
 */
function PlanningOnly() {
  return (
    <>
      <header className="top">
        <div>
          <h1 className="top__title">Your Tesco basket</h1>
          <p className="top__sub">Planning only on this copy</p>
        </div>
      </header>
      <main className="sheet">
        <div className="panel panel--plain">
          <p className="panel__head">
            <Icon.info size={19} />
            <span className="panel__title">Not available here</span>
          </p>
          <p className="row__covers">
            Adding to a real Tesco basket needs the small server that holds your session, and nothing
            is listening for this page. The dinners, the list and the quantities all work.
          </p>
          <p className="row__covers">
            To shop for real, run <code>npm run start:host</code> on your computer and open the
            address it prints from your phone, on the same WiFi.
          </p>
        </div>
      </main>
    </>
  );
}

/**
 * Which meals the shop cannot cover, and what is missing from each.
 *
 * A count of unresolved ingredients is not something anyone can act on. The
 * meal is: cook it anyway and pick those bits up yourself, or swap it out.
 * Consolidation is what makes this possible — each requirement still knows
 * which meals asked for it.
 */
function AtRisk({ match }: { match: LiveMatch }) {
  const risks = mealsAtRisk(match);
  return (
    <div className="panel">
      <p className="panel__head">
        <Icon.warning size={19} />
        <span className="panel__title">
          {risks.length === 1 ? "1 meal is short" : `${risks.length} meals are short`}
        </span>
      </p>
      <ul className="short">
        {risks.map((risk) => (
          <li key={risk.recipeId}>
            <details>
              <summary>
                <span className="short__name">{risk.recipeName}</span>
                <span className="short__n">{risk.problems.length} missing</span>
              </summary>
              <ul className="short__bits">
                {risk.problems.map((problem) => (
                  <li key={problem.ingredientName}>
                    {problem.ingredientName} — {reasonText(problem.reason)}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      <p className="short__bits">Swap them on the Meals tab, or add the rest and pick these up yourself.</p>
    </div>
  );
}

/**
 * What actually landed in the basket, checked against what we meant to add.
 *
 * This is the moment the app is either trustworthy or not. Listing the whole
 * basket answered the wrong question — half of it may be someone else's
 * shopping — so the list here is ours, and anything missing or short is at
 * the top, named by ingredient, because that is what you would go looking for.
 */
function Outcome({ check, total }: { check: Reconciliation; total: number }) {
  const good = check.problems.length === 0;
  // Packs, not lines: two tins of tomatoes is one thing on the list and two
  // things in the basket, and the totals below are about the basket.
  const packs = check.lines.reduce((sum, line) => sum + line.inBasket, 0);

  return (
    <>
      <div className={`result${good ? "" : " result--bad"}`}>
        <div className="result__head">
          <span className="result__mark">{good ? <Icon.check size={24} /> : <Icon.warning size={22} />}</span>
          <div>
            <p className="result__count">
              {good ? `All ${check.done} added` : `${check.done} of ${check.lines.length} added`}
            </p>
            <p className="result__when">Checked against your list, just now</p>
          </div>
        </div>
        <div className="bar">
          <div
            className="bar__fill"
            style={{ transform: `scaleX(${check.lines.length === 0 ? 0 : check.done / check.lines.length})` }}
          />
        </div>
      </div>

      {!good && (
        <div className="panel">
          <p className="panel__title">
            {check.problems.length === 1 ? "1 did not go in" : `${check.problems.length} did not go in`}
          </p>
          <ul className="misses">
            {check.problems.map((line) => (
              <li className="miss" key={line.productTitle}>
                <Icon.cross size={18} />
                <span>
                  <span className="miss__name">{line.ingredientName}</span>
                  <span className="miss__why">
                    {line.state === "short"
                      ? `Only ${line.inBasket} of ${line.wanted} packs went in`
                      : "Not added"}
                    {line.why && ` — ${line.why}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel panel--plain">
        <div className="totals">
          <p className="totals__row">
            <span>
              Your {check.done} item{check.done === 1 ? "" : "s"}
              {packs !== check.done && <span className="totals__row--quiet"> · {packs} packs</span>}
            </span>
          </p>
          {check.othersInBasket > 0 && (
            <p className="totals__row totals__row--quiet">
              <span>Already in the basket</span>
              <span>
                {check.othersInBasket} item{check.othersInBasket === 1 ? "" : "s"}
              </span>
            </p>
          )}
          <div className="totals__rule" />
          <p className="totals__row">
            <span style={{ fontWeight: 700 }}>Tesco total</span>
            <span className="totals__big">{money(total)}</span>
          </p>
          <p className="totals__note">
            Their figure — includes the minimum basket charge and anything added by someone else.
          </p>
        </div>
      </div>
    </>
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
  const [open, setOpen] = useState(false);
  const what = describe(conn, session, mode);

  // When it is working there is nothing to say, so say almost nothing. The
  // detail is one tap away for the times it stops working, which is when
  // anybody actually wants it.
  if (what.tone === "good" && !open) {
    return (
      <button className="conn conn--good" type="button" onClick={() => setOpen(true)}>
        <span className="conn__dot" />
        <span className="conn__what">{what.headline}</span>
        <Icon.right size={17} />
      </button>
    );
  }

  return (
    <div className={`panel ${what.tone === "bad" ? "" : "panel--plain"}`}>
      <p className="panel__head">
        <span className="conn__dot" style={{ background: what.tone === "bad" ? "var(--price)" : "var(--accent)" }} />
        <span className="panel__title">{what.headline}</span>
      </p>
      <p className="row__covers">{what.detail}</p>
      <p style={{ display: "flex", gap: "1rem" }}>
        <button className="more" type="button" onClick={onCheck} disabled={conn.state === "checking"}>
          {conn.state === "checking" ? "Checking…" : "Check again"}
        </button>
        {what.tone === "good" && (
          <button className="more" type="button" onClick={() => setOpen(false)}>
            Hide
          </button>
        )}
      </p>
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
      headline: `Connected · basket read ${conn.at}`,
      detail: `${conn.items === 0 ? "Your basket is empty" : `${conn.items} item${conn.items === 1 ? "" : "s"} in it`}. Anything you add will go here.`,
    };
  }
  if (conn.state === "failed") {
    if (conn.code === "SESSION_EXPIRED") {
      return { tone: "bad", headline: "Tesco signed you out", detail: CONNECT_HOW };
    }
    if (conn.code === "SESSION_MISSING") {
      return { tone: "bad", headline: "Not connected to Tesco yet", detail: CONNECT_HOW };
    }
    if (conn.code === "NOT_CONFIGURED" || conn.code === "UNSAFE_CONFIG") {
      return {
        tone: "bad",
        headline: "Tesco is not set up",
        detail: "The app does not yet know how to reach Tesco. See docs/live-basket.md on the computer running it.",
      };
    }
    return { tone: "bad", headline: "Not connected", detail: conn.message };
  }
  if (!session?.present) {
    return { tone: "bad", headline: "Not connected to Tesco yet", detail: CONNECT_HOW };
  }
  return { tone: "wait", headline: "Not checked yet", detail: "Tap Check again to see whether Tesco still accepts the session." };
}

function labelFor(code: string): string {
  switch (code) {
    case "SESSION_EXPIRED":
      return "Signed out.";
    case "SESSION_MISSING":
      return "Not connected.";
    case "OFFLINE":
      return "Server not running.";
    case "NOT_CONFIGURED":
      return "Not set up.";
    case "RATE_LIMITED":
      return "Too fast.";
    default:
      return "Tesco problem.";
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
