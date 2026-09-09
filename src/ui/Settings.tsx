import { useEffect, useState } from "react";
import type { BasketState } from "./useBasket";
import { talkingDirect } from "../domain/retailerClient";
import { whatItSaw } from "../domain/extension";
import { lastTescoAnswer, lastTescoSearchAnswer } from "../domain/tescoDirect";
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

        <Detail />
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

      <section className="panel">
        <h2 className="panel__head">
          <span className="label">Your Tesco basket</span>
        </h2>
        <Empty state={state} />
      </section>

      <section className="panel">
        <h2 className="panel__head">
          <span className="label">This copy</span>
        </h2>
        <p className="note note--version">
          Version <b>{__BUILD__}</b>, at <b>{location.host}</b>.
        </p>
        <p className="note">
          One computer answers to more than one address, and a phone keeps the app separately for
          each one. If this version is behind another device, pull down to refresh this page.
        </p>
      </section>

    </>
  );
}

/**
 * The one action here that can take away shopping this app did not add.
 *
 * Everything else removes only what it put in, which makes it safe by
 * construction. This is not, so it asks first, and says plainly whose
 * shopping is at stake rather than a general "are you sure".
 */
function Empty({ state }: { state: BasketState }) {
  const [asking, setAsking] = useState(false);
  const lines = state.inBasket + state.theirs.length;

  if(!state.connectedAt||state.phase==='offline'||state.phase==='disconnected') return <p className="note">Connect Tesco to read your basket.</p>;

  if (lines === 0) return <p className="note">Nothing in it.</p>;

  if (!asking) {
    return (
      <>
        <>{state.problem && <p className="note note--warn" role="alert">{state.problem}</p>}</><button disabled={state.syncing || state.phase === "adding"} className="wide wide--undo" type="button" onClick={() => setAsking(true)}>
          Empty the whole basket
        </button>
        <p className="note">
          Takes out all {lines} lines, including {state.theirs.length > 0 ? `the ${state.theirs.length} this app did not add` : "anything this app did not add"}.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="note note--warn">
        {state.theirs.length > 0
          ? `This also removes ${state.theirs.length} ${state.theirs.length === 1 ? "line" : "lines"} someone else put in. It cannot be undone from here.`
          : "This cannot be undone from here."}
      </p>
      <button
        className="wide wide--danger"
        type="button"
        disabled={state.syncing}
        onClick={() => { setAsking(false); void state.empty(); }}
      >
        {state.syncing ? "Emptying" : `Yes, empty all ${lines}`}
      </button>
      <button className="wide" type="button" onClick={() => setAsking(false)}>
        Leave it alone
      </button>
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

/**
 * What Tesco actually said, folded away until it is wanted.
 *
 * This lived on the blocking screen, where it was the only thing standing
 * between a wrong verdict and no way to argue with it. It has earned a
 * permanent home, but not a prominent one: nobody planning a week needs to
 * read HTTP statuses, and the moment they do need them, guessing is worse.
 */
function Detail() {
  const [open, setOpen] = useState(false);
  const saw = useSaw(talkingDirect() && open);
  if (!talkingDirect()) return null;

  const lines = {
    ...(saw ?? {}),
    ...(lastTescoAnswer() ? { answer: lastTescoAnswer() } : {}),
    ...(lastTescoSearchAnswer() ? { search: lastTescoSearchAnswer() } : {}),
  };

  return (
    <details className="detail" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>What Tesco said</summary>
      {Object.keys(lines).length === 0 ? (
        <p className="note">Nothing yet. Check the connection above.</p>
      ) : (
        <dl className="detail__list">
          {Object.entries(lines).map(([what, value]) => (
            <div key={what}>
              <dt>{WORDS[what] ?? what}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  );
}

/** Kept fresh only while the section is open. */
function useSaw(wanted: boolean): Record<string, string> | undefined {
  const [saw, setSaw] = useState<Record<string, string>>();
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    const look = () => void whatItSaw().then((seen) => { if (live) setSaw(seen); });
    look();
    const timer = setInterval(look, 3000);
    return () => { live = false; clearInterval(timer); };
  }, [wanted]);
  return saw;
}

const WORDS: Record<string, string> = {
  answer: "Tesco replied",
  search: "Last search",
  grab: "Reading the Tesco page",
  requests: "Seen a Tesco request",
  token: "Sign-in token",
  at: "Last looked",
};
