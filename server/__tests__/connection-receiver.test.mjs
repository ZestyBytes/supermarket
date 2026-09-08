import { test, expect, vi } from 'vitest';
import { createConnectionReceiver } from '../connection-receiver.mjs';
const origin = 'chrome-extension://test';
async function setup(verify = async () => ({ items: [] })) {
  const save = vi.fn();
  const server = createConnectionReceiver({ extensionId: 'test', verify, save });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, options);
  const close = () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  return { save, request, close };
}
const body = JSON.stringify({ cookie: 'test=fixture', headers: { authorization: 'Bearer fixture' } });
test('accepts privileged extension requests without Origin but rejects website spoofing', async () => {
  const t = await setup();
  try {
    expect((await t.request('/ready', { method: 'POST', headers: { 'X-Supermarket-Extension': 'test' } })).status).toBe(200);
    expect((await t.request('/ready', { method: 'POST', headers: { origin: 'https://evil.example', 'X-Supermarket-Extension': 'test' } })).status).toBe(403);
    expect((await t.request('/ready', { method: 'POST' })).status).toBe(403);
  } finally { await t.close(); }
});
test('rejects websites and missing nonce; never saves or verifies', async () => {
  const verify = vi.fn(); const t = await setup(verify);
  try {
    expect((await t.request('/ready', { method: 'POST', headers: { origin: 'https://evil.example' } })).status).toBe(403);
    expect((await t.request('/session', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body })).status).toBe(403);
    expect(verify).not.toHaveBeenCalled(); expect(t.save).not.toHaveBeenCalled();
  } finally { await t.close(); }
});
test('saves only a verified session and refuses duplicate transfer', async () => {
  const t = await setup();
  try {
    const { nonce } = await (await t.request('/ready', { method: 'POST', headers: { origin } })).json();
    const options = { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'X-Supermarket-Nonce': nonce }, body };
    const result = await t.request('/session', options);
    expect(await result.json()).toEqual({ ok: true }); expect(t.save).toHaveBeenCalledTimes(1);
    expect((await t.request('/session', options)).status).toBe(409);
  } finally { await t.close(); }
});
test('verification failures never save secrets or expose raw errors', async () => {
  const t = await setup(async () => { throw new Error('private-token'); });
  try {
    const { nonce } = await (await t.request('/ready', { method: 'POST', headers: { origin } })).json();
    const response = await t.request('/session', { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'X-Supermarket-Nonce': nonce }, body });
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('private-token'); expect(t.save).not.toHaveBeenCalled();
  } finally { await t.close(); }
});

