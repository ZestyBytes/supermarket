import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createConnectionReceiver } from './connection-receiver.mjs';
import { createOpenSupermarketsAdapter } from './adapters/open-supermarkets.mjs';
import { saveSession } from './session.mjs';

export const CONNECT_PORT = 8788;

/** Chrome derives an extension's id from its public key; so do we, to know who may talk to us. */
export function extensionId() {
  const manifest = JSON.parse(readFileSync(new URL('../browser-extension/manifest.json', import.meta.url), 'utf8'));
  return createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, x => String.fromCharCode(97 + parseInt(x, 16)));
}

/**
 * Listens for the browser extension for as long as the app is running.
 *
 * Tesco's token lasts about an hour, so reconnecting is not a one-off, it is
 * something you do again over a week of shopping. Running this inside the
 * server means reconnecting is a click in the extension, with no second
 * terminal and nothing to restart. Each connection is still verified against
 * Tesco before it replaces the stored one, and still has to be started from
 * the extension, so nothing is captured that you did not ask for.
 */
export function startConnectionReceiver({ onConnected } = {}) {
  const receiver = createConnectionReceiver({
    extensionId: extensionId(),
    once: false,
    verify: session => createOpenSupermarketsAdapter({ getSession: () => session }).readBasket(),
    save: session => saveSession(session.cookie, session),
    onConnected: basket => {
      console.log(`Connected to Tesco. Basket read succeeded (${basket.items.length} lines). Nothing was changed.`);
      onConnected?.(basket);
    },
  });

  receiver.on('error', error => {
    if (error.code === 'EADDRINUSE') console.error(`Connect helper: port ${CONNECT_PORT} is busy. Is "npm run connect" already running?`);
    else console.error('Connect helper could not start.');
  });

  receiver.listen(CONNECT_PORT, '127.0.0.1');
  return receiver;
}
