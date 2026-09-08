const base = 'http://127.0.0.1:8788';
const allowed = ['authorization', 'x-apikey', 'customer-uuid', 'language', 'region', 'user-agent', 'origin', 'referer'];
let busy = false;
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message.type !== 'connect') return;
  (async () => {
    try {
      const response = await fetch(`${base}/ready`, { method: 'POST', headers: { 'X-Supermarket-Extension': chrome.runtime.id } });
      if (!response.ok) { await chrome.storage.session.set({ until: 0, status: `Connection helper refused the request (${response.status}). Reload this extension in chrome://extensions and try again.` }); reply({ ok: false }); return; }
      const { nonce } = await response.json();
      await chrome.storage.session.set({ nonce, until: Date.now() + 300000, status: 'Now refresh your Tesco basket. Waiting for Tesco…' });
    } catch { await chrome.storage.session.set({ until: 0, status: 'Run npm run connect in the Supermarket folder, then try again.' }); }
    reply({ ok: true });
  })();
  return true;
});
chrome.webRequest.onBeforeSendHeaders.addListener(details => {
  void capture(details).catch(async () => { await chrome.storage.session.set({ status: 'Connection failed. Check the terminal, then click Connect again.', until: 0 }); });
}, { urls: ['https://xapi.tesco.com/*'] }, ['requestHeaders', 'extraHeaders']);
async function capture(details) {
  const state = await chrome.storage.session.get(['until', 'nonce']);
  if (busy || !(state.until > Date.now()) || details.tabId < 0) return;
  const headers = Object.fromEntries((details.requestHeaders || []).filter(h => allowed.includes(h.name.toLowerCase()) && h.value).map(h => [h.name.toLowerCase(), h.value]));
  if (!/^Bearer\s+/i.test(headers.authorization || '')) return;
  busy = true;
  try {
    const groups = await Promise.all(['https://www.tesco.com/', 'https://xapi.tesco.com/'].map(url => chrome.cookies.getAll({ url })));
    const cookies = [...new Map(groups.flat().map(c => [`${c.domain}|${c.path}|${c.name}`, c])).values()];
    const cookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const response = await fetch(`${base}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Supermarket-Extension': chrome.runtime.id, 'X-Supermarket-Nonce': state.nonce }, body: JSON.stringify({ cookie, headers }) });
    const result = await response.json();
    await chrome.storage.session.set({ until: 0, status: result.ok ? 'Connected. Tesco basket access verified. Return to Supermarket.' : `Connection failed (${result.code || response.status}). No basket changes made.` });
    await chrome.storage.session.remove('nonce');
  } finally { busy = false; }
}
