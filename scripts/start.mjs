import { spawn } from 'node:child_process';
import { hostname, networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * Both halves, one command.
 *
 * With --host the UI is offered to the home network so a phone can reach it.
 * The API is never opened up: it stays on loopback, and the dev server proxy
 * — running on this same machine — is the only way to it.
 */
const onNetwork = process.argv.includes('--host');
const vite = ['../node_modules/vite/bin/vite.js', ...(onNetwork ? ['--host'] : [])];

const children = [['../server/index.mjs'], vite].map(([file, ...args]) =>
  spawn(process.execPath, [fileURLToPath(new URL(file, import.meta.url)), ...args], { stdio: 'inherit', windowsHide: true }),
);

if (onNetwork) {
  const address = Object.values(networkInterfaces())
    .flat()
    .find((net) => net && net.family === 'IPv4' && !net.internal)?.address;

  setTimeout(() => {
    console.log('\n  On your phone, on the same WiFi, open:');
    console.log(`    http://${address ?? "<this computer's IP address>"}:5173`);
    // A router hands out a different address sooner or later, and a home-screen
    // icon saved against the old one stops working. The computer's own name
    // does not change, and phones resolve it on a home network.
    console.log(`    http://${hostname().toLowerCase()}.local:5173   (keeps working if the address changes)`);
    console.log('\n  Then use Share -> Add to Home Screen, and it opens like an app.\n');
  }, 1200);
}

let stopping = false;
function stop() { if (stopping) return; stopping = true; for (const child of children) child.kill(); }
for (const child of children) {
  child.on('exit', code => { if (stopping) return; process.exitCode = code ?? 1; stop(); });
  child.on('error', () => { console.error('Could not start Supermarket. Run npm install first.'); process.exitCode = 1; stop(); });
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
