import { createServer } from "node:http";
import { z } from "zod";
import { createOpenSupermarketsAdapter, retailerError } from "./adapters/open-supermarkets.mjs";
import { createMockAdapter } from "./adapters/mock.mjs";
import { createQueue } from "./queue.mjs";
import { describeSession, forgetSession, loadSession } from "./session.mjs";
import { submitBasket, submissionSchema } from "./basket.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const MOCK = process.argv.includes("--mock") || process.env.RETAILER === "mock";
const queue = createQueue({ minIntervalMs: 350, retries: 1 });
const client = MOCK ? createMockAdapter() : createOpenSupermarketsAdapter();
// retailer.config.json and captured request bodies are deliberately never loaded.
const routes = {
  "GET /api/health": async () => ({ ok: true, mode: MOCK ? "mock" : "live", integration: "open-supermarkets" }),
  "GET /api/session": async () => ({ ok: true, session: describeSession(loadSession()), mode: MOCK ? "mock" : "live" }),
  "DELETE /api/session": async () => { forgetSession(); return { ok: true, session: { present: false } }; },
  "GET /api/search": async url => {
    const query = z.string().trim().min(1).max(200).parse(url.searchParams.get("q"));
    const limit = z.coerce.number().int().min(1).max(10).parse(url.searchParams.get("limit") ?? 5);
    return { ok: true, query, results: await queue(() => client.search(query, limit)) };
  },
  "POST /api/search-batch": async (_url, body) => {
    const { queries } = z.object({ queries: z.array(z.string().trim().min(1).max(200)).min(1).max(60) }).parse(body);
    const unique = [...new Set(queries)];
    const results = await queue(async () => {
      if (client.searchBatch) return client.searchBatch(unique, 10);
      const results = [];
      for (const query of unique) results.push({ query, results: await client.search(query, 5) });
      return results;
    });
    return { ok: true, results };
  },
  "GET /api/basket": async () => ({ ok: true, basket: await queue(() => client.readBasket()) }),
  "POST /api/basket": async (_url, body) => {
    const input = submissionSchema.parse(body);
    // Queue the ENTIRE transaction; never retry basket mutations.
    return queue(() => submitBasket(client, input), { retryable: () => false });
  },
};

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const origins = new Set(["http://127.0.0.1:5173", "http://localhost:5173", `http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
  const mutating = ["POST", "DELETE"].includes(req.method);
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? "") || (origin && !origins.has(origin)) || (mutating && !origin)) return send(res, 403, { ok: false, error: { code: "BAD_REQUEST", message: "Use the local Supermarket app." } });
  if (origin) res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("cache-control", "no-store");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const route = routes[`${req.method} ${url.pathname}`];
  if (!route) return send(res, 404, { ok: false, error: { code: "NO_ROUTE", message: "Unknown route." } });
  try { send(res, 200, await route(url, req.method === "POST" ? await readJson(req) : undefined)); }
  catch (error) {
    const code = error instanceof z.ZodError ? "BAD_REQUEST" : error.code ?? "RETAILER_ERROR";
    const known = ["BAD_REQUEST", "SESSION_EXPIRED", "SESSION_MISSING", "BASKET_UNCERTAIN", "RATE_LIMITED", "RETAILER_ERROR"];
    const message = error instanceof z.ZodError ? "Check the product IDs, quantities and request fields." : known.includes(code) ? error.message : "The request could not be completed.";
    console.error(`${req.method} ${url.pathname} -> ${code}`);
    const status = code.startsWith("SESSION_") ? 401 : code === "BAD_REQUEST" ? 400 : code === "BASKET_UNCERTAIN" ? 409 : code === "RATE_LIMITED" ? 429 : 502;
    send(res, status, { ok: false, error: { code, message } });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Supermarket API: http://127.0.0.1:${PORT} (${MOCK ? "mock" : "Open Supermarkets / Tesco"})`));
function send(res, status, payload) { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(payload)); }
async function readJson(req) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw retailerError("BAD_REQUEST", "JSON is required.");
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 64000) throw retailerError("BAD_REQUEST", "Request too large."); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw retailerError("BAD_REQUEST", "Invalid JSON."); }
}
