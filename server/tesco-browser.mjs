import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function chromeArguments(profile, port, headless = false) {
  return [`--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, ...(headless ? ['--headless=new'] : []), 'about:blank'];
}

// Launch installed Chrome normally, retaining its default security sandbox.
// Attach only to our dedicated profile; never attach to the user's normal profile.
export async function launchTescoBrowser(profile, headless) {
  const executable = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(root => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')).find(existsSync);
  if (!executable) throw new Error('Google Chrome is not installed.');
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  const child = spawn(executable, chromeArguments(profile, port, headless), { windowsHide: headless, stdio: 'ignore' });
  let spawnFailed = false;
  child.on('error', () => { spawnFailed = true; });
  let browser;
  for (let i = 0; i < 30 && !spawnFailed; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 700 }); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  if (!browser) { child.kill(); throw new Error('Could not connect to the dedicated Chrome window.'); }
  return {
    context: browser.contexts()[0],
    async close() {
      try { const connection = await browser.newBrowserCDPSession(); await connection.send('Browser.close'); } catch { /* It may already be closed. */ }
      await browser.close().catch(() => {});
      child.kill();
    },
  };
}
