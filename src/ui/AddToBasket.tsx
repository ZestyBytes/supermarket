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

  if(state.phase==='connecting'||state.phase==='matching'||state.phase==='adding') {
    const matching = state.phase === 'matching';
    return (
      <div className="dock">
        <div className="working" role="status" aria-live="polite">
          <span className="working__text">
            {state.phase === 'adding' ? 'Adding to Tesco' : matching ? 'Finding ingredients' : 'Connecting'}
            {matching && (
              <span className="working__n">
                {state.progress.done}/{state.progress.total}
              </span>
            )}
          </span>
          <progress
            aria-label={matching ? 'Ingredients checked' : 'Tesco basket update'}
            max={state.progress.total || 1}
            value={matching ? state.progress.done : undefined}
          />
        </div>
      </div>
    );
  }

  if(state.problem) return <div className="dock"><div className="task-progress" role="alert"><p>{state.problem}</p><button className="basket-link" onClick={state.recheck}>Check Tesco again <Icon name="retry" size={18}/></button></div></div>;

  if (state.phase === "added") {
    const failed = state.items.filter((item) => item.state === "failed").length;
    return (
      <div className="dock">
        <p className={`done${failed ? " done--part" : ""}`}>
          <Icon name={failed ? "warning" : "check"} size={20} />
          {failed === 0
            ? `All ${lines} in your ${state.mode==='mock'?'demo':'Tesco'} basket · ${money(state.total)}`
            : `${lines - failed} of ${lines} added. See the shopping list.`}
        </p>
      </div>
    );
  }

  return (
    <div className="dock">
      <button className="dock__go" type="button" disabled={lines === 0} onClick={state.add}>
          <>
            <span>Add {lines} items to basket</span>
            <span className="dock__price">{money(state.estimated)}</span>
          </>
      </button>
      {missing > 0 && (
        <p className="dock__note">
          {missing === 1 ? "1 ingredient needs" : `${missing} ingredients need`} a check in your shopping list.
        </p>
      )}
    </div>
  );
}
