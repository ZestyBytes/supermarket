import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
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
    console.log(`  http://${address ?? '<this computer\'s IP address>'}:5173\n`);
  }, 1200);
}

let stopping = false;
function stop() { if (stopping) return; stopping = true; for (const child of children) child.kill(); }
for (const child of children) {
  child.on('exit', code => { if (stopping) return; process.exitCode = code ?? 1; stop(); });
  child.on('error', () => { console.error('Could not start Supermarket. Run npm install first.'); process.exitCode = 1; stop(); });
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
