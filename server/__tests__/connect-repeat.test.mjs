import { describe, expect, it, afterEach } from 'vitest';
import { createConnectionReceiver } from '../connection-receiver.mjs';

/**
 * Tesco's token lasts about an hour, so reconnecting is routine, not a one-off.
 * A receiver that latches shut after the first success forces a restart of the
 * whole app every time, which is the thing that made this tedious.
 */
const EXT = 'abcdefghijklmnopqrstuvwxyzabcdef';
const SESSION = { cookie: 'a=1', headers: { authorization: 'Bearer token-value' } };
let open;

afterEach(() => open?.close());

async function receiver(options) {
  const saved = [];
  const server = createConnectionReceiver({
    extensionId: EXT,
    verify: async () => ({ items: [] }),
    save: (session) => saved.push(session),
    ...options,
  });
  open = server;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const head = { 'X-Supermarket-Extension': EXT };

  async function nonce() {
    const ready = await fetch(`${base}/ready`, { method: 'POST', headers: head });
    return ready.ok ? (await ready.json()).nonce : null;
  }

  async function pushWith(value) {
    const push = await fetch(`${base}/session`, {
      method: 'POST',
      headers: { ...head, 'Content-Type': 'application/json', 'X-Supermarket-Nonce': value },
      body: JSON.stringify(SESSION),
    });
    return push.status;
  }

  async function connect() {
    const ready = await fetch(`${base}/ready`, { method: 'POST', headers: head });
    if (!ready.ok) return ready.status;
    const { nonce } = await ready.json();
    const push = await fetch(`${base}/session`, {
      method: 'POST',
      headers: { ...head, 'Content-Type': 'application/json', 'X-Supermarket-Nonce': nonce },
      body: JSON.stringify(SESSION),
    });
    return push.status;
  }
  return { connect, nonce, pushWith, saved };
}

describe('connection receiver', () => {
  it('accepts reconnecting again and again when it lives inside the server', async () => {
    const { connect, saved } = await receiver({ once: false });
    expect(await connect()).toBe(200);
    expect(await connect()).toBe(200);
    expect(await connect()).toBe(200);
    expect(saved).toHaveLength(3);
  });

  it('still latches shut for the one-shot setup helper', async () => {
    const { connect, saved } = await receiver({ once: true });
    expect(await connect()).toBe(200);
    expect(await connect()).not.toBe(200);
    expect(saved).toHaveLength(1);
  });

  it('lets the extension hold one nonce and refresh with it on a timer', async () => {
    const { nonce, pushWith, saved } = await receiver({ once: false });
    const held = await nonce();
    expect(await pushWith(held)).toBe(200);
    expect(await pushWith(held)).toBe(200);
    expect(saved).toHaveLength(2);
  });

  it('rejects a nonce from a previous run, so the extension knows to ask again', async () => {
    const first = await receiver({ once: false });
    const stale = await first.nonce();
    first.saved.length = 0;
    open.close();

    const second = await receiver({ once: false });
    expect(await second.pushWith(stale)).toBe(403);
    expect(second.saved).toHaveLength(0);
    expect(await second.pushWith(await second.nonce())).toBe(200);
  });

  it('refuses a caller that is not the extension', async () => {
    const { saved } = await receiver({ once: false });
    const port = open.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/ready`, { method: 'POST' });
    expect(response.status).toBe(403);
    expect(saved).toHaveLength(0);
  });
});
