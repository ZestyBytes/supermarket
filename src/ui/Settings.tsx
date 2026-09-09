import type { BasketState } from "./useBasket";
import { Icon } from "./Icon";

interface Props {
  state: BasketState;
  servings: number;
  wanted: number;
  onServings: (n: number) => void;
  onWanted: (n: number) => void;
  picked: number;
  onClear: () => void;
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
export function Settings({ state, servings, wanted, onServings, onWanted, picked, onClear }: Props) {
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

        <p className="note">
          Signing in lasts about an hour. When it lapses, open the Supermarket extension in Chrome and click Connect.
          Your Tesco session never leaves your own computer.
        </p>
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

      {picked > 0 && (
        <section className="panel">
          <button className="wide wide--undo" type="button" onClick={onClear}>
            Start the week again
          </button>
          <p className="note">
            Unpicks all {picked} dinners. Anything already added to your Tesco basket stays there.
          </p>
        </section>
      )}
    </>
  );
}

function describe(state: BasketState): { tone: "good" | "bad" | "wait"; headline: string; detail: string } {
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
