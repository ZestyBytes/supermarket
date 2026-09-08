import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
const clean = z.string().min(1).max(32000).refine(v => !/[\r\n]/.test(v));
const schema = z.object({ cookie: clean, headers: z.object({
  authorization: clean.refine(v => /^Bearer\s+\S+$/i.test(v)),
  'x-apikey': clean.optional(), 'customer-uuid': clean.optional(), language: clean.optional(), region: clean.optional(),
  'user-agent': clean.optional(), origin: z.literal('https://www.tesco.com').optional(),
  referer: clean.refine(v => v.startsWith('https://www.tesco.com/')).optional(),
}).strict() }).strict();
export function createConnectionReceiver({ extensionId, verify, save, onConnected = () => {} }) {
  const origin = `chrome-extension://${extensionId}`;
  const nonce = randomBytes(32).toString('hex');
  let busy = false, done = false;
  return createServer(async (req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    // Privileged extension fetches can omit Origin. Require a custom header
    // in that case; websites cannot send it without an origin-checked preflight.
    const permitted = req.headers.origin === origin || (!req.headers.origin && req.headers['x-supermarket-extension'] === extensionId);
    if (!permitted || !/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) return send(403, { ok: false });
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Supermarket-Nonce, X-Supermarket-Extension');
      res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && req.url === '/ready' && !done) return send(200, { nonce });
    if (req.method !== 'POST' || req.url !== '/session') return send(404, { ok: false });
    if (done || busy) return send(409, { ok: false });
    if (req.headers['x-supermarket-nonce'] !== nonce) return send(403, { ok: false });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { ok: false });
    busy = true;
    try {
      let body = '', size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 65536) return send(413, { ok: false }); body += chunk; }
      let input;
      try { input = schema.parse(JSON.parse(body)); } catch { console.error('Connection payload failed validation; no session saved.'); return send(400, { ok: false, code: 'SESSION_FORMAT_INVALID' }); }
      const { authorization, ...apiHeaders } = input.headers;
      const session = { cookie: input.cookie, authorization, apiHeaders };
      const basket = await verify(session);
      await save(session);
      done = true;
      send(200, { ok: true });
      onConnected(basket);
    } catch (error) { send(502, { ok: false, code: ['SESSION_EXPIRED', 'SESSION_MISSING', 'RETAILER_ERROR'].includes(error?.code) ? error.code : 'VERIFICATION_FAILED' }); }
    finally { busy = false; }
  });
}
