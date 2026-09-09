import { homedir } from 'node:os';
import { join } from 'node:path';
import { createServer } from "node:http";
import { z } from "zod";
import { createOpenSupermarketsAdapter, retailerError } from "./adapters/open-supermarkets.mjs";
import { createMockAdapter } from "./adapters/mock.mjs";
import { createQueue } from "./queue.mjs";
import { describeSession, forgetSession, loadSession } from "./session.mjs";
import { releaseStaleLock, removeFromBasket, removalSchema, submitBasket, submissionSchema } from "./basket.mjs";
import { startConnectionReceiver } from "./connect.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const MOCK = process.argv.includes("--mock") || process.env.RETAILER === "mock";
const attemptsDirectory = MOCK ? join(homedir(), '.supermarket', 'mock-attempts') : undefined;
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
    return queue(() => submitBasket(client, input, attemptsDirectory), { retryable: () => false });
  },
  "POST /api/basket/remove": async (_url, body) => {
    const input = removalSchema.parse(body);
    // Same rule as adding: the whole transaction is queued, and never retried
    // from out here, because it does its own retrying where it can tell what
    // has already happened.
    return queue(() => removeFromBasket(client, input, attemptsDirectory), { retryable: () => false });
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
// A port left held by an earlier run is the commonest way this fails, and a
// raw EADDRINUSE stack says nothing about what to do next.
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use. An earlier Supermarket server is still running.`);
    console.error("Stop it and try again:");
    console.error(`  Windows      Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`);
    console.error(`  macOS/Linux  kill $(lsof -ti tcp:${PORT})`);
    process.exit(1);
  }
  throw error;
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Supermarket API: http://127.0.0.1:${PORT} (${MOCK ? "mock" : "Open Supermarkets / Tesco"})`);
  // We have just taken the port, so nothing of ours can be mid-write. A lock
  // here belongs to a run that is over.
  void releaseStaleLock(attemptsDirectory);
  // Say it here rather than letting the first search fail with "signed out".
  if (!MOCK) {
    startConnectionReceiver();
    if (!loadSession()) console.log("Not connected to Tesco yet. Open the Supermarket extension in Chrome and click Connect.");
  }
});
function send(res, status, payload) { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(payload)); }
async function readJson(req) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw retailerError("BAD_REQUEST", "JSON is required.");
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 64000) throw retailerError("BAD_REQUEST", "Request too large."); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw retailerError("BAD_REQUEST", "Invalid JSON."); }
}

