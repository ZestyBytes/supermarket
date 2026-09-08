#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { createConnectionReceiver } from '../server/connection-receiver.mjs';
import { extensionId } from '../server/connect.mjs';
import { createOpenSupermarketsAdapter } from '../server/adapters/open-supermarkets.mjs';
import { saveSession } from '../server/session.mjs';
if (process.argv.includes('--headless')) process.exit(1);
const server = createConnectionReceiver({ extensionId: extensionId(),
  verify: async session => {
    try { return await createOpenSupermarketsAdapter({ getSession: () => session }).readBasket(); }
    catch (error) { console.error(`Tesco verification failed (${['SESSION_EXPIRED', 'SESSION_MISSING', 'RETAILER_ERROR'].includes(error?.code) ? error.code : 'VERIFICATION_FAILED'}). Nothing saved; no basket changes made.`); throw error; }
  },
  save: session => saveSession(session.cookie, session),
  onConnected: basket => { console.log(`CONNECTED: Tesco basket read succeeded (${basket.items.length} lines). No basket changes made.`); setTimeout(stop, 1500); },
});
const timer = setTimeout(() => { console.log('Connection window expired. Run npm run connect to try again.'); stop(); }, 15 * 60_000);
function stop() { clearTimeout(timer); server.close(); server.closeIdleConnections(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.on('error', () => { console.error('Connection helper could not start. Check whether npm run connect is already running.'); clearTimeout(timer); process.exitCode = 1; });
server.listen(8788, '127.0.0.1', () => {
  console.log('Only needed for first-time setup — once the extension is loaded, npm start listens for it.');
  console.log('In your usual Chrome, open chrome://extensions, enable Developer mode, and Load unpacked:');
  console.log(fileURLToPath(new URL('../browser-extension', import.meta.url)));
  console.log('Then open Supermarket Tesco Connect from the extensions menu, click Connect, and refresh your Tesco basket.');
  console.log('Waiting for your connection (15 minutes). No credentials or DevTools copying needed.');
});
