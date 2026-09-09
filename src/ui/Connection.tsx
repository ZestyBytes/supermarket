import type { BasketState } from './useBasket';

/**
 * Whether Tesco is there, in the top corner, as small as it can honestly be.
 *
 * When it is working there is nothing to say, so it says nothing: a green dot,
 * and a tap target around it that opens Settings. "Tesco connected" was a
 * label on the state you are in ninety-nine times out of a hundred.
 *
 * When it is not working the words come back. A red dot alone is invisible to
 * anyone who cannot pick it out from the green one, and this is the one state
 * that asks something of you, so it is also the one state worth the room.
 */
export function Connection({ state, onOpenSettings }: { state: BasketState; onOpenSettings: () => void }) {
  const bad = state.phase === 'offline' || state.phase === 'disconnected';
  const checking = state.phase === 'connecting';
  const demo = state.mode === 'mock';
  const words = bad ? 'Reconnect Tesco' : demo ? 'Demo preview' : null;

  return (
    <button
      className={`connection-pill${bad ? ' connection-pill--bad' : ''}${words ? '' : ' connection-pill--quiet'}`}
      onClick={onOpenSettings}
      aria-label={
        bad
          ? 'Tesco needs attention. Open settings'
          : checking
            ? 'Checking the Tesco connection. Open settings'
            : 'Connected to Tesco. Open settings'
      }
    >
      <span className={`connection-dot${checking ? ' is-loading' : ''}`} aria-hidden="true" />
      {words && <span>{words}</span>}
    </button>
  );
}
