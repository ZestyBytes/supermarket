import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const children = ['../server/index.mjs', '../node_modules/vite/bin/vite.js'].map(file => spawn(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], { stdio: 'inherit', windowsHide: true }));
let stopping = false;
function stop() { if (stopping) return; stopping = true; for (const child of children) child.kill(); }
for (const child of children) { child.on('exit', code => { if (stopping) return; process.exitCode = code ?? 1; stop(); }); child.on('error', () => { console.error('Could not start Supermarket. Run npm install first.'); process.exitCode = 1; stop(); }); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
