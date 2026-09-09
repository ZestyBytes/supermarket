import type { BasketState } from "./useBasket";
import { Icon } from "./Icon";

/**
 * Whether Tesco is there, said once, at the top, before anything else.
 *
 * There is no point choosing a week you cannot buy, so this is the first thing
 * on the screen and the first thing the app does. When it is working it is a
 * thin green line you stop noticing; when it is not, it is the only thing
 * worth reading, and it says exactly what to do.
 */
export function Connection({ state, onOpenSettings }: { state: BasketState; onOpenSettings: () => void }) {
  const what = describe(state);

  return (
    <div className={`link link--${what.tone}`} role="status">
      <span className="link__dot" aria-hidden="true" />
      <span className="link__text">
        <strong>{what.headline}</strong>
        {what.detail && <span className="link__detail">{what.detail}</span>}
      </span>
      {what.tone === "bad" && (
        <button className="link__again" type="button" onClick={onOpenSettings}>
          <Icon name="settings" size={16} />
          Fix
        </button>
      )}
    </div>
  );
}

function describe(state: BasketState): { tone: "good" | "bad" | "wait"; headline: string; detail?: string } {
  switch (state.phase) {
    case "connecting":
      return { tone: "wait", headline: "Connecting to Tesco…" };
    case "offline":
      return {
        tone: "bad",
        headline: "Not running on this computer",
        detail: "Start Supermarket on the machine that holds your Tesco session.",
      };
    case "disconnected":
      return {
        tone: "bad",
        headline: "Tesco not connected",
        detail: state.problem ?? "Open the Supermarket extension in Chrome, click Connect, then refresh your Tesco tab.",
      };
    case "matching":
      return { tone: "wait", headline: "Checking prices at Tesco…" };
    case "adding":
      return { tone: "wait", headline: "Adding to your Tesco basket…" };
    default:
      return {
        tone: "good",
        headline: "Connected to Tesco",
        detail: state.connectedAt ? `Basket read at ${state.connectedAt}` : undefined,
      };
  }
}
