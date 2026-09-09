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

  // A button, but only where one earns its place. It is not in the ordinary
  // path, because picking the dinner was the decision and pressing send again
  // afterwards is the same decision twice. It is here, where the automatic
  // attempt has failed and waiting has stopped being an answer.
  if (state.problem) {
    return (
      <div className="dock">
        <div className="working working--bad" role="alert">
          <span className="working__text">{state.problem}</span>
          <button className="working__again" type="button" disabled={state.syncing} onClick={state.sendNow}>
            {state.syncing ? "Sending" : "Send to Tesco now"}
          </button>
        </div>
      </div>
    );
  }

  const missing = state.match?.review.length ?? 0;
  const pending = state.items.filter((item) => item.state === "ready").length;

  // Nothing to say until something is actually in the basket. No bar, no
  // heading, no "filling your basket": that is the app narrating work nobody
  // asked to watch. Once there is a real number it stays on screen and moves,
  // which tells you the same thing without ever being about itself.
  if (state.inBasket === 0) return null;

  return (
    <div className="dock">
      <p className="done">
        <Icon name="check" size={18} />
        {state.inBasket} in your {state.mode === "mock" ? "demo" : "Tesco"} basket · {money(state.total)}
        {pending > 0 && <span className="done__note">{pending} more going in</span>}
        {pending === 0 && missing > 0 && <span className="done__note">{missing} to pick up yourself</span>}
      </p>
    </div>
  );
}
