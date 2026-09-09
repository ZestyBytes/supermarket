import { money } from "../domain/units";
import type { BasketState } from "./useBasket";
import { Icon } from "./Icon";

/**
 * One button, at the bottom of the list it acts on.
 *
 * Doing it automatically was worse in practice than in principle. The work
 * went off somewhere invisible, arrived a line at a time, and left no moment
 * you could point at and say "that is when my basket changed", which is a
 * strange thing not to know about your own shopping.
 *
 * So the decision comes back. What it does not go back to is a button that
 * only adds: it applies the difference between this list and the basket, so
 * ticking something off as already in the cupboard takes it out again, and
 * the same press handles both.
 */
export function AddToBasket({ state }: { state: BasketState }) {
  if (state.phase === "offline" || state.phase === "disconnected") return null;

  const shop = state.mode === "mock" ? "demo" : "Tesco";
  const { adding, removing } = state.outstanding;
  const busy = state.syncing;
  const checking = state.items.some((item) => item.state === "checking");

  if (state.problem) {
    return (
      <div className="dock">
        <p className="dock__why" role="alert">{state.problem}</p>
        <button className="dock__go" type="button" disabled={busy} onClick={state.sendNow}>
          {busy ? "Sending" : "Try again"}
        </button>
      </div>
    );
  }

  if (adding === 0 && removing === 0) {
    if (state.inBasket === 0) return null;
    return (
      <div className="dock">
        <p className="done">
          <Icon name="check" size={18} />
          {state.inBasket} in your {shop} basket · {money(state.total)}
        </p>
      </div>
    );
  }

  return (
    <div className="dock">
      <button className="dock__go" type="button" disabled={busy || checking} onClick={state.sendNow}>
        {busy ? (
          `Updating your ${shop} basket`
        ) : checking ? (
          "Checking prices"
        ) : (
          <>
            <span>{label(adding, removing)}</span>
            {adding > 0 && <span className="dock__price">{money(state.estimated)}</span>}
          </>
        )}
      </button>
    </div>
  );
}

/** Say what the press will do, including the part that takes things away. */
function label(adding: number, removing: number): string {
  const goes = adding === 1 ? "Add 1 item" : `Add ${adding} items`;
  const comes = removing === 1 ? "remove 1" : `remove ${removing}`;
  if (adding === 0) return removing === 1 ? "Remove 1 item from basket" : `Remove ${removing} items from basket`;
  if (removing === 0) return `${goes} to basket`;
  return `${goes}, ${comes}`;
}
