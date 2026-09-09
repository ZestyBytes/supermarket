import { money } from "../domain/units";
import type { BasketState } from "./useBasket";
import { Icon } from "./Icon";

/**
 * What the basket is doing, said quietly, with nothing to press.
 *
 * There used to be a button here, and before that a progress card with a
 * heading and a sentence. Both were the app asking a person to take part in
 * work it can finish on its own: choosing a dinner already meant "I want to
 * cook this", and pressing Add afterwards was a second decision standing in
 * for no new information.
 *
 * So this reports and does not ask. It appears when there is something true to
 * say and disappears when the basket matches the week, because a line that
 * always says "fine" is a line nobody reads.
 */
export function AddToBasket({ state, meals }: { state: BasketState; meals: number }) {
  if (meals === 0) return null;
  if (state.phase === "offline" || state.phase === "disconnected") return null;

  if (state.problem) {
    return (
      <div className="dock">
        <div className="working working--bad" role="alert">
          <span className="working__text">{state.problem}</span>
          <button className="working__again" type="button" onClick={state.recheck}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const missing = state.match?.review.length ?? 0;

  // Nothing at all while it works. Filling the basket is not a task the person
  // is doing, so a progress bar for it is the app talking about itself. What
  // is worth saying is what ended up in there, and that can wait until it has.
  if (state.syncing || state.items.some((item) => item.state === "ready")) return null;

  if (state.inBasket === 0) return null;

  return (
    <div className="dock">
      <p className="done">
        <Icon name="check" size={18} />
        {state.inBasket} in your {state.mode === "mock" ? "demo" : "Tesco"} basket · {money(state.total)}
        {missing > 0 && <span className="done__note">{missing} to pick up yourself</span>}
      </p>
    </div>
  );
}
