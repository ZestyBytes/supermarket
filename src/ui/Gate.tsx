import type { BasketState } from "./useBasket";
import { talkingDirect } from "../domain/retailerClient";
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
              ? "Open tesco.com in another tab and sign in, then come back and check again. Nothing else is needed: this uses the same session your browser already has."
              : "Your Tesco sign-in has expired, which it does about once an hour. Open the Supermarket extension in Chrome, click Connect, then come back here."}
        </p>

        {state.problem && <p className="gate__why">{state.problem}</p>}

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
