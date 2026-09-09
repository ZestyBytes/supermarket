import type { BasketState } from "./useBasket";
import { useEffect, useState } from "react";
import { talkingDirect } from "../domain/retailerClient";
import { whatItSaw } from "../domain/extension";
import { lastTescoAnswer } from "../domain/tescoDirect";
import { Icon } from "./Icon";

/**
 * The screen you get when Tesco is not there, and only then.
 *
 * Blocking on the check itself would put a spinner in front of every cold
 * start for the sake of a request that usually answers in under a second, and
 * planning a week is worth doing whether or not you can buy it this minute.
 * Blocking on a failure is different: without this you can pick seven dinners
 * before finding out that none of it can be bought, which is exactly the
 * wasted effort worth preventing.
 */
export function Gate({ state, onIgnore }: { state: BasketState; onIgnore: () => void }) {
  const offline = state.phase === "offline";
  // In the extension there is no server and no Connect: being signed in to
  // Tesco in this browser is the whole of it, so telling someone to click a
  // button that no longer exists would be the worst kind of wrong.
  const direct = talkingDirect();
  const saw = useSaw(direct && !offline);

  return (
    <div className="gate" role="alertdialog" aria-labelledby="gate-title">
      <div className="gate__card">
        <span className="gate__mark" aria-hidden="true">
          <Icon name="warning" size={26} />
        </span>

        <h1 className="gate__title" id="gate-title">
          {offline ? "Supermarket is not running here" : direct ? "You are not signed in to Tesco" : "Tesco is not connected"}
        </h1>

        <p className="gate__body">
          {offline
            ? "This page can plan a week on its own, but adding to a real basket happens on the computer that holds your Tesco session. Start Supermarket there and open it again."
            : direct
              ? "Check again will open Tesco in the background and try. If it still says this, open tesco.com in another tab, sign in, load your basket once, and come back."
              : "Your Tesco sign-in has expired, which it does about once an hour. Open the Supermarket extension in Chrome, click Connect, then come back here."}
        </p>

        {state.problem && <p className="gate__why">{state.problem}</p>}

        {direct && !offline && (
          <dl className="gate__saw">
            {Object.entries({
              ...(saw ?? { requests: "none seen yet" }),
              ...(lastTescoAnswer() ? { answer: lastTescoAnswer() } : {}),
            }).map(([what, value]) => (
              <div key={what}>
                <dt>{plainly(what)}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}

        <button className="gate__go" type="button" onClick={state.recheck} disabled={state.phase === "connecting"}>
          <Icon name="retry" size={17} />
          {state.phase === "connecting" ? "Checking" : "Check again"}
        </button>

        <button className="gate__skip" type="button" onClick={onIgnore}>
          Plan the week anyway
        </button>
      </div>
    </div>
  );
}

/** Read once when the gate appears, and kept fresh while it is on screen. */
function useSaw(wanted: boolean): Record<string, string> | undefined {
  const [saw, setSaw] = useState<Record<string, string>>();
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    const look = () => {
      void whatItSaw().then((seen) => {
        if (live && Object.keys(seen).length > 0) setSaw(seen);
      });
    };
    look();
    const timer = setInterval(look, 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [wanted]);
  return saw;
}

const WORDS: Record<string, string> = {
  watcher: "Watcher",
  store: "Token in page storage",
  answer: "Tesco replied",
  hosts: "Tesco pages called",
  requests: "Seen a Tesco request",
  sawHeaders: "Headers on it",
  token: "Sign-in token",
  at: "Last looked",
};

function plainly(what: string): string {
  return WORDS[what] ?? what;
}
