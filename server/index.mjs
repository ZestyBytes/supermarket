import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { createHttpAdapter, retailerError } from "./adapters/http.mjs";
import { createMockAdapter } from "./adapters/mock.mjs";
import { createQueue } from "./queue.mjs";
import { describeSession, forgetSession, loadSession, sessionPath } from "./session.mjs";

/**
 * The local half of the app.
 *
 * The browser cannot talk to a retailer directly — the cookie is scoped to the
 * retailer's domain, CORS blocks the call, and any script on the page could
 * read a cookie the page held. So the session stays here, on the shopper's own
 * machine, and the page asks this server to act for it. Nothing is hosted:
 * bind to loopback only and the session never leaves the laptop.
 */
const PORT = Number(process.env.PORT ?? 8787);
const MOCK = process.argv.includes("--mock") || process.env.RETAILER === "mock";
const CONFIG_FILE = process.env.RETAILER_CONFIG ?? "retailer.config.json";

const queue = createQueue({ minIntervalMs: 350, retries: 1 });

function adapter() {
  if (MOCK) return createMockAdapter();
  if (!existsSync(CONFIG_FILE)) {
    throw retailerError(
      "NOT_CONFIGURED",
      `No ${CONFIG_FILE}. Copy retailer.config.example.json to ${CONFIG_FILE} and fill in the endpoints, or start with --mock.`,
    );
  }
  const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  return createHttpAdapter(config, () => loadSession()?.cookie);
}

const routes = {
  "GET /api/health": async () => ({ ok: true, mode: MOCK ? "mock" : "live", sessionFile: sessionPath() }),

  "GET /api/session": async () => ({ ok: true, session: describeSession(loadSession()), mode: MOCK ? "mock" : "live" }),

  "DELETE /api/session": async () => {
    forgetSession();
    return { ok: true, session: { present: false } };
  },

  "GET /api/search": async (url) => {
    const query = url.searchParams.get("q");
    if (!query) throw retailerError("BAD_REQUEST", "Pass a search term as ?q=");
    const limit = Math.min(20, Number(url.searchParams.get("limit") ?? 10));
    const results = await queue(() => adapter().search(query, limit));
    return { ok: true, query, results };
  },

  "GET /api/basket": async () => ({ ok: true, basket: await queue(() => adapter().readBasket()) }),

  "POST /api/basket": async (_url, body) => {
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) throw retailerError("BAD_REQUEST", "Send { items: [{ productId, qty }] }");

    const client = adapter();
    const added = [];
    const failed = [];

    // One product at a time, through the same queue as everything else.
    for (const item of items) {
      try {
        await queue(() => client.addToBasket(item.productId, Number(item.qty) || 1));
        added.push(item);
      } catch (error) {
        failed.push({ ...item, error: describeError(error) });
        // A dead session will not recover on the next item; stop asking.
        if (error?.code === "SESSION_EXPIRED") break;
      }
    }

    // Never report what we sent — report what the retailer says it holds.
    // A partial failure is still a successful call: the caller needs the
    // read-back and the per-item reasons, not a bare error.
    const basket = await queue(() => client.readBasket());
    return { ok: true, added, failed, basket };
  },
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const key = `${req.method} ${url.pathname}`;

  res.setHeader("access-control-allow-origin", "http://localhost:5173");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return end(res, 204, "");

  const route = routes[key];
  if (!route) return send(res, 404, { ok: false, error: { code: "NO_ROUTE", message: `No route for ${key}` } });

  try {
    const body = req.method === "POST" ? await readJson(req) : undefined;
    send(res, 200, await route(url, body));
  } catch (error) {
    const described = describeError(error);
    // Log the classification, never the cause's body — it can echo the cookie.
    console.error(`${key} → ${described.code}: ${described.message}`);
    send(res, statusFor(described.code), { ok: false, error: described });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Supermarket local server on http://127.0.0.1:${PORT} (${MOCK ? "mock" : "live"} retailer)`);
  console.log(`Session file: ${sessionPath()}`);
  if (!MOCK && !loadSession()) console.log("No session imported yet — run: npm run tesco:import");
});

function describeError(error) {
  return {
    code: error?.code ?? "RETAILER_ERROR",
    message: error?.message ?? "Something went wrong talking to the retailer.",
  };
}

function statusFor(code) {
  if (code === "SESSION_MISSING" || code === "SESSION_EXPIRED") return 401;
  if (code === "NOT_CONFIGURED") return 501;
  if (code === "BAD_REQUEST") return 400;
  if (code === "RATE_LIMITED") return 429;
  return 502;
}

function send(res, status, payload) {
  end(res, status, JSON.stringify(payload), "application/json");
}

function end(res, status, body, type) {
  res.writeHead(status, type ? { "content-type": type } : undefined);
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw retailerError("BAD_REQUEST", "Body was not valid JSON.");
  }
}
