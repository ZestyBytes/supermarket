import type { BasketState } from "./useBasket";
import { Icon } from "./Icon";

interface Props {
  state: BasketState;
  servings: number;
  wanted: number;
  onServings: (n: number) => void;
  onWanted: (n: number) => void;
}

/**
 * The things you set once and the one thing you occasionally have to fix.
 *
 * How many people you cook for and how many dinners you want are answered
 * once and then not thought about again, so they had no business sitting
 * above the meals every time. The Tesco connection is the opposite: it lapses
 * about once an hour, and when it does you want somewhere deliberate to look
 * at it and press a button, not a status line you have learned to skim past.
 */
export function Settings({ state, servings, wanted, onServings, onWanted }: Props) {
  const link = describe(state);

  return (
    <>
      <section className="panel">
        <h2 className="panel__head">
          <span className="label">Tesco</span>
        </h2>

        <div className={`wire wire--${link.tone}`}>
          <span className="wire__dot" aria-hidden="true" />
          <span className="wire__text">
            <strong>{link.headline}</strong>
            <span>{link.detail}</span>
          </span>
        </div>

        <button className="wide" type="button" onClick={state.recheck} disabled={state.phase === "connecting"}>
          <Icon name="retry" size={17} />
          {state.phase === "connecting" ? "Checking" : "Check the connection"}
        </button>

        <p className="note">If Tesco signs you out, reconnect using the Chrome extension.</p>
        <a className="basket-link" href="https://www.tesco.com/groceries/en-GB/trolley" target="_blank" rel="noreferrer">Manage Tesco basket <Icon name="external" size={18}/></a>
        <p className="note">Remove items or check out at Tesco.</p>
      </section>

      <section className="panel">
        <h2 className="panel__head">
          <span className="label">Your week</span>
        </h2>

        <label className="row">
          <span className="row__name">Cooking for</span>
          <select value={servings} onChange={(event) => onServings(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1} {index === 0 ? "person" : "people"}
              </option>
            ))}
          </select>
        </label>

        <label className="row">
          <span className="row__name">Dinners a week</span>
          <select value={wanted} onChange={(event) => onWanted(Number(event.target.value))}>
            {Array.from({ length: 14 }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1} dinners
              </option>
            ))}
          </select>
        </label>

        <p className="note">Changing who you are cooking for updates the amounts for every dinner you have picked.</p>
      </section>

    </>
  );
}

function describe(state: BasketState): { tone: "good" | "bad" | "wait"; headline: string; detail: string } {
  if(state.mode==='mock')return {tone:'wait',headline:'Demo preview',detail:'Sample products and prices. Your real basket is not connected.'};
  switch (state.phase) {
    case "connecting":
      return { tone: "wait", headline: "Checking", detail: "Asking Tesco whether it knows you." };
    case "offline":
      return {
        tone: "bad",
        headline: "Not running here",
        detail: "Open Supermarket on the computer that holds your Tesco session.",
      };
    case "disconnected":
      return { tone: "bad", headline: "Not connected", detail: state.problem ?? "Your Tesco sign-in has expired." };
    default:
      return {
        tone: "good",
        headline: "Connected",
        detail: state.connectedAt ? `Your basket was read at ${state.connectedAt}.` : "Ready to shop.",
      };
  }
}
