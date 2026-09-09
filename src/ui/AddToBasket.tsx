import { money } from "../domain/units";
import type { BasketState } from "./useBasket";
import { Icon } from "./Icon";

/**
 * The only button that does anything irreversible, and the only one that
 * needed to exist.
 *
 * "Review ingredients" and "Review Tesco products" were signposts to work the
 * app can do on its own; they made a three-step wizard out of one decision.
 * This waits until the checking is finished, then asks once.
 */
export function AddToBasket({ state, meals }: { state: BasketState; meals: number }) {
  if (meals === 0) return null;

  const missing = state.match?.review.length ?? 0;
  const lines = state.match?.choices.length ?? 0;

  if (state.phase === "offline" || state.phase === "disconnected") return null;

  if (state.phase === "added") {
    const failed = state.items.filter((item) => item.state === "failed").length;
    return (
      <div className="dock">
        <p className={`done${failed ? " done--part" : ""}`}>
          <Icon name={failed ? "warning" : "check"} size={20} />
          {failed === 0
            ? `All ${lines} in your Tesco basket · ${money(state.total)}`
            : `${lines - failed} of ${lines} added. See the shopping list.`}
        </p>
      </div>
    );
  }

  const busy = state.phase === "connecting" || state.phase === "matching" || state.phase === "adding";

  return (
    <div className="dock">
      <button className="dock__go" type="button" disabled={busy || lines === 0} onClick={state.add}>
        {state.phase === "adding" ? (
          "Adding…"
        ) : busy ? (
          "Checking Tesco…"
        ) : (
          <>
            <span>Add {lines} items to basket</span>
            <span className="dock__price">{money(state.estimated)}</span>
          </>
        )}
      </button>
      {missing > 0 && !busy && (
        <p className="dock__note">
          {missing === 1 ? "1 ingredient" : `${missing} ingredients`} Tesco has nothing for, so you will need to pick
          {missing === 1 ? " it" : " them"} up yourself.
        </p>
      )}
    </div>
  );
}
