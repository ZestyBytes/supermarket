import type { BasketState } from "./useBasket";
import { Icon } from "./Icon";

/**
 * Whether the basket matches the list, and the one press that makes it.
 *
 * It used to say "7 in your Tesco basket · £15.13". Both numbers are already
 * on the list above, one line at a time and next to the thing they describe,
 * so repeating them at the bottom was arithmetic nobody had asked for. What is
 * not answerable from a glance at a long list is the only thing worth a
 * summary: is this done, partly done, or wrong.
 */
export function AddToBasket({ state }: { state: BasketState }) {
  if (state.phase === "offline" || state.phase === "disconnected") return null;

  const { adding, removing } = state.outstanding;
  const failed = state.items.filter((item) => item.state === "failed").length;
  const missing = state.items.filter((item) => item.state === "missing").length;
  const checking = state.items.some((item) => item.state === "checking");
  const nothingYet = state.inBasket === 0 && adding === 0 && removing === 0;

  if (nothingYet && !state.problem) return null;

  if (state.problem || failed > 0) {
    return (
      <div className="dock">
        <p className="flag flag--bad" role="alert">
          <Icon name="warning" size={17} />
          {state.problem ?? (failed === 1 ? "One line did not go in" : `${failed} lines did not go in`)}
        </p>
        <button className="dock__go" type="button" disabled={state.syncing} onClick={state.sendNow}>
          {state.syncing ? "Trying again" : "Try again"}
        </button>
      </div>
    );
  }

  if (adding > 0 || removing > 0) {
    return (
      <div className="dock">
        <button
          className="dock__go"
          type="button"
          disabled={state.syncing || checking}
          onClick={state.sendNow}
        >
          {state.syncing ? "Updating your basket" : checking ? "Checking prices" : label(adding, removing)}
        </button>
      </div>
    );
  }

  // Everything the list asks for is in the basket. Amber if some of it could
  // not be, because "done" and "done apart from three things" are not the same
  // answer and the difference is the part you have to act on.
  return (
    <div className="dock">
      <p className={`flag ${missing > 0 ? "flag--part" : "flag--good"}`} role="status">
        <Icon name={missing > 0 ? "warning" : "check"} size={17} />
        {missing > 0
          ? `In your basket, apart from ${missing === 1 ? "1 thing Tesco" : `${missing} things Tesco`} had none of`
          : "Your basket matches this list"}
      </p>
    </div>
  );
}

/** Say what the press will do, including the part that takes things away. */
function label(adding: number, removing: number): string {
  const goes = adding === 1 ? "Add 1 item" : `Add ${adding} items`;
  if (adding === 0) return removing === 1 ? "Remove 1 item from basket" : `Remove ${removing} items from basket`;
  if (removing === 0) return `${goes} to basket`;
  return `${goes}, remove ${removing}`;
}
