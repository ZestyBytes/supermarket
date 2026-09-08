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

export function LivePanel({ requirements }: Props) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [mode, setMode] = useState<"live" | "mock">("live");
  const [stage, setStage] = useState<Stage>("idle");
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [basket, setBasket] = useState<RetailerBasket | null>(null);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const [progress, setProgress] = useState("");
  const [reach, setReach] = useState<"checking" | "ok" | "absent">("checking");

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

  async function verify() {
    try {
      setBasket(await readBasket());
      setProblem(null);
    } catch (error) {
      report(error);
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
        <SessionRow session={session} mode={mode} onRefresh={refreshSession} />

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
        No session imported. Run <code>npm run tesco:import</code> and paste the Cookie header from a
        signed-in tab.
      </p>
    );
  }
  return (
    <p className="retailer__session">
      Session imported {session.ageHours != null && session.ageHours < 48 ? `${session.ageHours}h ago` : "a while ago"}
      {session.cookieCount ? ` · ${session.cookieCount} cookies` : ""}.{" "}
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
