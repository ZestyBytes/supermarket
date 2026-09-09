import { spawn, execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const WINDOWS = process.platform === 'win32';

/**
 * Keeps Supermarket running on this computer, and up to date.
 *
 * Three jobs, all of which you would otherwise do yourself:
 *
 *   - Puts the app back if it ever stops. Something that dies at five o'clock
 *     should not mean a dead app at six when someone reaches for their phone.
 *   - Watches GitHub. When the branch moves ahead it pulls, installs if the
 *     dependencies changed, and restarts on the same ports, so an icon saved
 *     to a phone's home screen keeps working.
 *   - Leaves your work alone. If anything here has been edited it says so and
 *     keeps running what you have, rather than pulling over the top of it.
 *
 * It does not touch the Tesco connection. That is the extension's job and it
 * already does it: tick "Stay connected" in the Supermarket extension and it
 * mints a fresh token every half hour on its own.
 *
 *   npm run keep
 */

const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const CHECK_MS = Number(options.checkMinutes ?? 10) * 60_000;
const HEALTH_MS = Number(options.healthSeconds ?? 30) * 1000;
const UI_PORT = Number(options.uiPort ?? 5173);
const API_PORT = Number(options.apiPort ?? 8787);
// A crash that repeats is not worth hammering: back off, and say so once.
const BACKOFF_MS = [0, 2_000, 5_000, 15_000, 30_000, 60_000];
/** Told to the wrapper: I have replaced my own code, start me again. */
const RESTART_ME = 75;

function say(text) {
  console.log(`[${new Date().toLocaleTimeString()}] ${text}`);
}

/** git, with the answer trimmed and failures returned rather than thrown. */
async function git(...args) {
  try {
    const { stdout } = await run('git', args, { cwd: root });
    return { ok: true, out: stdout.trim() };
  } catch (error) {
    return { ok: false, out: String(error.stderr ?? error.message).trim() };
  }
}

/**
 * Whether node_modules is older than the lockfile that describes it.
 *
 * npm writes node_modules/.package-lock.json on every install, so comparing
 * the two timestamps says whether an install has happened since the
 * dependencies last changed. Checking out a commit touches the files it
 * updates, so a pull done by hand shows up here exactly like one done by us.
 *
 * Without this, pulling in a terminal and then double-clicking the shortcut
 * fails on the first missing module, backs off, and keeps failing, with the
 * fix being a command nobody has been told to run.
 */
async function needsInstall() {
  try {
    const [lock, installed] = await Promise.all([
      stat(new URL('../package-lock.json', import.meta.url)),
      stat(new URL('../node_modules/.package-lock.json', import.meta.url)),
    ]);
    return lock.mtimeMs > installed.mtimeMs;
  } catch {
    // No lockfile is nothing to check against; no node_modules certainly
    // needs one, and stat failing there is how that shows up.
    try {
      await stat(new URL('../node_modules', import.meta.url));
      return false;
    } catch {
      return true;
    }
  }
}

async function install(why) {
  say(why);
  try {
    await run(WINDOWS ? 'npm.cmd' : 'npm', ['install', '--silent'], { cwd: root, shell: WINDOWS });
    return true;
  } catch {
    say('npm install did not finish cleanly. Starting anyway.');
    return false;
  }
}

/** True when there is nothing of yours to lose by pulling. */
async function clean() {
  const unstaged = await git('diff', '--quiet');
  const staged = await git('diff', '--cached', '--quiet');
  return unstaged.ok && staged.ok;
}

/** This file, as it is on disk right now. */
async function ownHash() {
  try {
    return createHash('sha1').update(await readFile(new URL(import.meta.url))).digest('hex');
  } catch {
    return '';
  }
}

async function lockHash() {
  try {
    return createHash('sha1').update(await readFile(new URL('../package-lock.json', import.meta.url))).digest('hex');
  } catch {
    return '';
  }
}

/** Pull if GitHub is ahead. Returns true when something actually changed. */
/**
 * The branch origin actually publishes, not the one we happen to be on.
 *
 * Falls back to main, which is where this project lives, when the remote will
 * not say.
 */
async function defaultBranch() {
  const head = await git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  if (head.ok && head.out) return head.out.replace(/^origin\//, '');
  return 'main';
}

async function update() {
  const branch = await git('rev-parse', '--abbrev-ref', 'HEAD');
  if (!branch.ok) return false;

  // Sitting on another branch, or on no branch at all, is the quiet way this
  // goes wrong: every check passes, nothing is behind, and the app stays weeks
  // out of date because it is watching a branch nobody pushes to.
  if (branch.out === 'HEAD') {
    say('This folder is not on a branch, so there is nothing to update from. Run: git checkout main');
    return false;
  }

  const fetched = await git('fetch', '--quiet', 'origin', branch.out);
  if (!fetched.ok) {
    say('Could not reach GitHub. Carrying on with what we have.');
    return false;
  }

  const here = await git('rev-parse', 'HEAD');
  const there = await git('rev-parse', `origin/${branch.out}`);
  if (!here.ok || !there.ok) return false;

  if (here.out === there.out) {
    const main = await defaultBranch();
    if (branch.out !== main) {
      const ahead = await git('rev-list', '--count', `HEAD..origin/${main}`);
      const behind = Number(ahead.out || 0);
      if (behind > 0) {
        say(`This folder is on "${branch.out}", which is up to date, but origin/${main} is ${behind} commits ahead.`);
        say(`Nothing here will change until you run: git checkout ${main}`);
      }
    }
    return false;
  }

  if (!(await clean())) {
    say('New version on GitHub, but this folder has edits. Leaving it alone.');
    return false;
  }

  say(`New version found. Updating ${branch.out}.`);
  const before = await lockHash();
  const pulled = await git('pull', '--ff-only', '--quiet', 'origin', branch.out);
  if (!pulled.ok) {
    say('Update failed. Staying on the version we have.');
    return false;
  }

  if ((await lockHash()) !== before) await install('Dependencies changed. Installing.');

  const subject = await git('log', '-1', '--pretty=%s');
  say(`Updated to: ${subject.out}`);
  return true;
}

let app = null;
let stopping = false;
let failures = 0;

/**
 * Take the ports back before starting.
 *
 * The app is two processes under an npm wrapper, and a wrapper that dies does
 * not always take them with it. One survivor still holding 5173 means every
 * restart from here fails with "port already in use", which turns a supervisor
 * into an infinite loop that never serves a page. Ask the operating system
 * what is on the port and end it, whatever it belongs to.
 */
async function freePorts() {
  for (const port of [UI_PORT, API_PORT]) {
    try {
      if (WINDOWS) {
        const { stdout } = await run('netstat', ['-ano', '-p', 'TCP']);
        const pids = new Set(
          stdout
            .split(/\r?\n/)
            .filter((line) => new RegExp(`:${port}\\s`).test(line) && /LISTENING/i.test(line))
            .map((line) => line.trim().split(/\s+/).pop())
            .filter((pid) => pid && pid !== '0'),
        );
        for (const pid of pids) await run('taskkill', ['/PID', pid, '/T', '/F']).catch(() => {});
      } else {
        // LISTEN only. Without it lsof also names whatever is *connected*
        // to the port, and killing the app's own visitors is not the job.
        const { stdout } = await run('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']);
        for (const pid of stdout.split(/\s+/).filter(Boolean).map(Number)) {
          if (pid === process.pid) continue;
          try { process.kill(pid, 'SIGKILL'); } catch {}
        }
      }
    } catch {
      // Nothing listening, or no tool to ask with. Either way, carry on and
      // let the start attempt be the thing that reports a real problem.
    }
  }
}

async function start() {
  await freePorts();
  say('Starting Supermarket.');
  app = spawn(WINDOWS ? 'npm.cmd' : 'npm', ['run', 'start:host'], {
    cwd: root,
    stdio: 'inherit',
    shell: WINDOWS,
  });
  app.on('error', () => say('Could not start Supermarket. Is Node installed and npm install run?'));
}

async function stop() {
  const child = app;
  app = null;
  if (!child || child.exitCode !== null) return;

  if (WINDOWS) {
    // npm spawns node underneath it, so the tree is the only thing worth
    // killing: kill npm alone and the ports stay held.
    await run('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(() => {});
  } else {
    // Signal the child, never `process.kill(-pid)`. Killing a process group
    // by negative pid is one detached-flag mishap away from killing the
    // supervisor along with it, which is exactly what it did: it announced a
    // restart, took itself out, and left the app orphaned and unwatched.
    // freePorts below is the precise way to reach the grandchildren.
    child.kill('SIGTERM');
  }

  // Give it a moment to let go of the ports, then take back anything that
  // did not: an exited wrapper is no guarantee its children have gone, and a
  // wedged one cannot act on SIGTERM at all.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await freePorts();
}

/** Running is not the same as working: ask it for a page. */
async function answering() {
  try {
    const response = await fetch(`http://127.0.0.1:${UI_PORT}/`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  say('Supermarket supervisor started. Ctrl+C stops it and the app together.');
  say(`Folder: ${root}`);
  const onBranch = await git('rev-parse', '--abbrev-ref', 'HEAD');
  const running = await git('log', '-1', '--pretty=%h %s');
  say(`Branch: ${onBranch.out || 'unknown'}`);
  say(`Running: ${running.out || 'unknown'}`);
  say(`Checking GitHub every ${CHECK_MS / 60000} minutes.`);

  // The update at startup is the one that caught this app out: it is also the
  // one running the old code, so it needs the same handover as the periodic
  // check. Doing it here, before anything has been started, costs nothing.
  const ownAtStart = await ownHash();
  const pulled = await update();
  if (pulled && (await ownHash()) !== ownAtStart) {
    say('The supervisor itself changed. Handing over to the new one.');
    process.exit(RESTART_ME);
  }
  // Catches the pull you did yourself in a terminal, not just ours.
  if (await needsInstall()) await install('Dependencies have changed since the last install. Installing.');
  let settleUntil = 0;

  async function restart(why, deliberate = false) {
    if (why) say(why);
    await stop();
    if (deliberate) failures = 0;
    else {
      const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
      failures += 1;
      if (wait) {
        say(`Waiting ${wait / 1000}s before trying again.`);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      if (failures === BACKOFF_MS.length) {
        say('Supermarket keeps failing to start. Check the messages above; still trying, more slowly.');
      }
    }
    if (stopping) return;
    await start();
    // Longer than a health check, so a slow boot is never mistaken for a
    // wedged one.
    settleUntil = Date.now() + 20_000;
  }

  await restart(null, true);

  let lastCheck = Date.now();

  while (!stopping) {
    await new Promise((resolve) => setTimeout(resolve, HEALTH_MS));
    if (stopping) break;

    // Serving is the only thing that counts, and the process handle is not it.
    // On Windows npm runs behind a cmd.exe wrapper that exits while node keeps
    // going, so "the child has an exit code" meant a healthy app was killed and
    // restarted every thirty seconds: each restart re-read the Tesco basket,
    // which is how a working setup talked itself into a rate limit.
    if (await answering()) {
      failures = 0;
    } else if (Date.now() > settleUntil) {
      await restart(
        app && app.exitCode === null
          ? 'Supermarket is not answering. Restarting.'
          : 'Supermarket stopped. Restarting.',
      );
    }

    if (!stopping && Date.now() - lastCheck >= CHECK_MS) {
      lastCheck = Date.now();
      const own = await ownHash();
      if (await update()) {
        // Pulling a new supervisor does not make this one new. Node read this
        // file into memory when it started and will never read it again, so
        // the update landed on disk while the old logic kept running: the fix
        // for the restart loop arrived and the restart loop carried on. Hand
        // back to the wrapper, which starts the version that was just pulled.
        if ((await ownHash()) !== own) {
          say('The supervisor itself changed. Handing over to the new one.');
          await stop();
          process.exit(RESTART_ME);
        }
        await restart('Restarting on the new version.', true);
      }
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    say('Stopping Supermarket.');
    stop().finally(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error(error);
  stop().finally(() => process.exit(1));
});
