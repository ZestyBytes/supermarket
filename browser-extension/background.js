const base = 'http://127.0.0.1:8788';
const allowed = ['authorization', 'x-apikey', 'customer-uuid', 'language', 'region', 'user-agent', 'origin', 'referer'];
const TROLLEY = 'https://www.tesco.com/groceries/en-GB/trolley';
const REFRESH_MINUTES = 30;   // Tesco's token lasts about an hour.
const WINDOW_MS = 300000;     // A single Connect click stays open this long.
let busy = false;

/* ---------- the app itself ---------- */

/**
 * The toolbar button opens the app in a tab, not a popup.
 *
 * A popup is the right shape for a switch and the wrong one for something you
 * spend ten minutes in. This is a full page with its own URL, which can be
 * pinned, bookmarked and left open like any other.
 */
const APP = 'app/index.html';

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL(APP);
  const [open] = await chrome.tabs.query({ url });
  if (open) await chrome.tabs.update(open.id, { active: true });
  else await chrome.tabs.create({ url });
});

/**
 * Lend the app the two headers a Tesco page adds.
 *
 * Not the cookies: the browser sends those itself, as it does for any site,
 * which is the whole reason this version has no session to look after. These
 * two are not cookies, so they have to be borrowed from a request the Tesco
 * page made, and they are held in memory only.
 */
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message?.type === 'tesco-headers') {
    chrome.storage.session.get('tescoHeaders').then(({ tescoHeaders }) => reply({ headers: tescoHeaders }));
    return true;
  }

  // Ask Tesco's own page to make a request, so there is one to borrow from.
  //
  // Being signed in is not the same as having been watched signing in. The
  // headers can only be taken from a request Tesco's page makes, so a tab
  // opened before this extension was loaded has never given us one, and the
  // app says "not signed in" to someone who plainly is. Rather than asking a
  // person to go and refresh a tab, fetch it.
  if (message?.type === 'tesco-refresh') {
    mintQuietly()
      .then(() => reply({ ok: true }))
      .catch(() => reply({ ok: false }));
    return true;
  }
});

/* ---------- staying connected ---------- */

/**
 * Tesco's token dies after roughly an hour, so a session captured once is
 * stale by the evening. Left to the person, that means noticing the app has
 * gone quiet and clicking Connect again, which is the whole annoyance.
 *
 * With "Stay connected" on, this opens a Tesco page in the background every
 * half hour, lets it mint a token as it normally would, captures that, and
 * closes the tab. Nothing is clicked, nothing is shown, and the app is simply
 * always connected. It is off until switched on, and switching it off stops
 * every part of it.
 */
async function staying() {
  return (await chrome.storage.local.get('keepConnected')).keepConnected === true;
}

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);

async function schedule() {
  if (await staying()) chrome.alarms.create('refresh', { periodInMinutes: REFRESH_MINUTES, delayInMinutes: 0.1 });
  else chrome.alarms.clear('refresh');
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'refresh' || !(await staying())) return;
  await mintQuietly();
});

/** Nudge a Tesco page into asking for a fresh token, then get out of the way. */
async function mintQuietly() {
  const [existing] = await chrome.tabs.query({ url: 'https://www.tesco.com/groceries/*' });
  if (existing) return void chrome.tabs.reload(existing.id);

  const tab = await chrome.tabs.create({ url: TROLLEY, active: false });
  // Long enough for the page to make its first API call, short enough that a
  // stray tab never lingers if it does not.
  setTimeout(() => chrome.tabs.remove(tab.id).catch(() => {}), 45000);
}

/* ---------- the one-off Connect button ---------- */

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message.type === 'keep') {
    (async () => {
      await chrome.storage.local.set({ keepConnected: message.on === true });
      await schedule();
      await chrome.storage.session.set({
        status: message.on ? 'Staying connected. Nothing else to do.' : 'Automatic reconnection off.',
      });
      reply({ ok: true });
      if (message.on) void mintQuietly().catch(() => chrome.storage.session.set({
        status: 'Automatic connection could not start. Check that Tesco opens normally and Supermarket is running.',
      }));
    })().catch(async () => {
      await chrome.storage.session.set({ status: 'Could not update automatic connection. Reload this extension at chrome://extensions.' });
      reply({ ok: false });
    });
    return true;
  }

  if (message.type !== 'connect') return;
  (async () => {
    try {
      const nonce = await freshNonce();
      if (!nonce) {
        await chrome.storage.session.set({ until: 0, status: 'Supermarket is not running on this computer. Start it, then try again.' });
        reply({ ok: false });
        return;
      }
      await chrome.storage.session.set({ nonce, until: Date.now() + WINDOW_MS, status: 'Now refresh your Tesco basket. Waiting for Tesco…' });
      await mintQuietly();
    } catch {
      await chrome.storage.session.set({ until: 0, status: 'Supermarket is not running on this computer. Start it, then try again.' });
    }
    reply({ ok: true });
  })();
  return true;
});

async function freshNonce() {
  const response = await fetch(`${base}/ready`, { method: 'POST', headers: { 'X-Supermarket-Extension': chrome.runtime.id } });
  if (!response.ok) return null;
  return (await response.json()).nonce;
}

/* ---------- capture ---------- */

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    void capture(details).catch(async () => {
      await chrome.storage.session.set({ status: 'Connection failed. Is Supermarket running on this computer?', until: 0 });
    });
  },
  { urls: ['https://xapi.tesco.com/*'] },
  ['requestHeaders', 'extraHeaders'],
);

async function capture(details) {
  if (details.tabId < 0) return;

  const headers = Object.fromEntries(
    (details.requestHeaders || []).filter(h => allowed.includes(h.name.toLowerCase()) && h.value).map(h => [h.name.toLowerCase(), h.value]),
  );
  if (!/^Bearer\s+/i.test(headers.authorization || '')) return;

  // Always, and before anything else decides it is not interested. The app in
  // the tab needs these whether or not the old local-server handshake is going
  // on, and they go no further than this browser's memory.
  await chrome.storage.session.set({ tescoHeaders: headers });

  // The rest is only for a local server, which the in-tab app does not use.
  if (busy) return;
  const keep = await staying();
  const state = await chrome.storage.session.get(['until', 'nonce']);
  const invited = state.until > Date.now();
  if (!keep && !invited) return;

  busy = true;
  try {
    const groups = await Promise.all(['https://www.tesco.com/', 'https://xapi.tesco.com/'].map(url => chrome.cookies.getAll({ url })));
    const cookies = [...new Map(groups.flat().map(c => [`${c.domain}|${c.path}|${c.name}`, c])).values()];
    const cookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // The server mints a new nonce each time it starts, so a stored one goes
    // stale across a restart. Fetch a fresh one and try once more rather than
    // reporting a failure the person cannot act on.
    let nonce = state.nonce ?? (await freshNonce());
    let result = await push(cookie, headers, nonce);
    if (result.status === 403) {
      nonce = await freshNonce();
      if (nonce) result = await push(cookie, headers, nonce);
    }

    const body = await result.json().catch(() => ({}));
    await chrome.storage.session.set({
      nonce: keep ? nonce : undefined,
      until: 0,
      status: body.ok
        ? keep
          ? `Connected, and staying connected. Last refreshed ${new Date().toLocaleTimeString()}.`
          : 'Connected. Return to Supermarket.'
        : `Connection failed (${body.code || result.status}). No basket changes made.`,
    });
    if (!keep) await chrome.storage.session.remove('nonce');
  } finally {
    busy = false;
  }
}

function push(cookie, headers, nonce) {
  return fetch(`${base}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Supermarket-Extension': chrome.runtime.id,
      'X-Supermarket-Nonce': nonce,
    },
    body: JSON.stringify({ cookie, headers }),
  });
}
