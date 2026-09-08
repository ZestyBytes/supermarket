import { useEffect, useState } from "react";
import {
  addToBasket,
  getSession,
  readBasket,
  RetailerError,
  search,
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

    // Sequential on purpose: the server queues these anyway, and a burst is
    // what gets the searches refused.
    for (const [index, requirement] of requirements.entries()) {
      setProgress(`Searching ${index + 1} of ${requirements.length}: ${requirement.ingredient.name}`);
      try {
        found.set(requirement.ingredient.id, await search(searchTermFor(requirement)));
      } catch (error) {
        if (error instanceof RetailerError && (error.code === "SESSION_EXPIRED" || error.code === "OFFLINE")) {
          report(error);
          setStage("idle");
          setProgress("");
          return;
        }
        found.set(requirement.ingredient.id, []);
      }
    }

    setProgress("");
    setMatch(chooseLiveProducts(found, requirements));
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
              <span className="notice__how"> Sign in again in your browser, then run <code>npm run tesco:import</code>.</span>
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
                </li>
              ))}
            </ul>

            {match.review.length > 0 && (
              <div className="retailer__review">
                <p className="label">
                  {match.review.length} needing your eye — not added automatically
                </p>
                <ul>
                  {match.review.slice(0, 6).map((item) => (
                    <li key={item.requirement.ingredient.id}>
                      <strong>{item.requirement.ingredient.name}</strong> — {reasonFor(item.reason)}
                    </li>
                  ))}
                  {match.review.length > 6 && <li>…and {match.review.length - 6} more.</li>}
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
            disabled={!match || match.choices.length === 0 || stage === "sending"}
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
        detail: "On the computer running the app: sign in to Tesco in your browser, then run npm run tesco:import.",
      };
    }
    if (conn.code === "SESSION_MISSING") {
      return {
        tone: "bad",
        headline: "Not connected — no Tesco session yet",
        detail: "On the computer running the app, run npm run tesco:import and paste the details from a signed-in Tesco tab.",
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
      detail: "On the computer running the app, run npm run tesco:import and paste the details from a signed-in Tesco tab.",
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

function reasonFor(reason: "no-results" | "unreadable-size" | "wrong-unit"): string {
  switch (reason) {
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
