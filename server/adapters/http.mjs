import { fill, pick, pickAll } from "../pick.mjs";
import { redact } from "../session.mjs";

/**
 * A retailer client driven entirely by config.
 *
 * No retailer's internal endpoints are hard-coded here — guessing them would
 * produce a client that silently does the wrong thing. `retailer.config.json`
 * declares the URLs, the request shape and where the interesting values sit in
 * the response; this module does the talking, the cookie handling and the
 * error classification.
 */
export function createHttpAdapter(config, getCookie) {
  requireConfig(config);

  async function call(spec, values = {}) {
    const cookie = getCookie();
    if (!cookie) throw retailerError("SESSION_MISSING", "No retailer session imported.");

    const url = new URL(fill(spec.path, values), config.baseUrl);
    const init = {
      method: spec.method ?? "GET",
      headers: {
        // The cookie goes on the wire and nowhere else: not to the browser,
        // not into an error message, not into a log.
        cookie,
        accept: "application/json",
        "user-agent": config.userAgent ?? "Supermarket/0.1 (local meal planner)",
        ...(config.headers ?? {}),
        ...(spec.headers ?? {}),
      },
      redirect: "manual",
    };

    if (spec.body) {
      init.headers["content-type"] = spec.contentType ?? "application/json";
      init.body = typeof spec.body === "string" ? fill(spec.body, values) : JSON.stringify(render(spec.body, values));
    }

    let response;
    try {
      response = await fetch(url, init);
    } catch (cause) {
      throw retailerError("NETWORK", `Could not reach ${url.host}.`, { cause });
    }

    if (response.status === 401 || response.status === 403) {
      throw retailerError(
        "SESSION_EXPIRED",
        "The retailer rejected the session. Sign in again in your browser and re-import the cookie.",
        { status: response.status },
      );
    }
    // A login redirect is an expired session wearing a different hat.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") ?? "";
      if (/login|signin|auth/i.test(location)) {
        throw retailerError("SESSION_EXPIRED", "The retailer redirected to sign-in. Re-import the cookie.", {
          status: response.status,
        });
      }
    }
    if (response.status === 429) {
      throw retailerError("RATE_LIMITED", "The retailer asked us to slow down.", { status: 429 });
    }
    if (!response.ok) {
      const body = redact((await response.text()).slice(0, 300), cookie);
      throw retailerError("RETAILER_ERROR", `${response.status} from ${url.pathname}: ${body}`, {
        status: response.status,
      });
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      // HTML where JSON was expected almost always means a sign-in wall.
      throw retailerError(
        "SESSION_EXPIRED",
        `${url.pathname} returned a page rather than data, which usually means the session is no longer signed in.`,
      );
    }
  }

  return {
    id: config.retailer ?? "retailer",
    live: true,

    async search(query, limit = 10) {
      const payload = await call(config.search, { query, limit });
      const items = pickAll(payload, config.search.results, config.search.fields);
      return items
        .filter((item) => item.id && item.title)
        .slice(0, limit)
        .map((item) => ({
          id: String(item.id),
          title: String(item.title),
          price: Number(item.price ?? 0),
          size: item.size == null ? undefined : String(item.size),
          url: item.url ? new URL(String(item.url), config.baseUrl).toString() : undefined,
        }));
    },

    async readBasket() {
      const payload = await call(config.basket.read);
      return {
        items: pickAll(payload, config.basket.read.results, config.basket.read.fields).map((item) => ({
          id: String(item.id),
          title: String(item.title ?? ""),
          qty: Number(item.qty ?? 0),
          price: Number(item.price ?? 0),
        })),
        // The retailer's own total is authoritative — it knows about delivery,
        // packaging, offers and anything already in the basket. Never
        // substitute our estimate for it.
        total: Number(pick(payload, config.basket.read.total) ?? 0),
      };
    },

    async addToBasket(productId, qty) {
      await call(config.basket.add, { productId, qty });
      return { ok: true };
    },
  };
}

function render(body, values) {
  if (typeof body === "string") return fill(body, values);
  if (Array.isArray(body)) return body.map((entry) => render(entry, values));
  if (body && typeof body === "object") {
    return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, render(value, values)]));
  }
  return body;
}

function requireConfig(config) {
  for (const path of ["baseUrl", "search.path", "search.results", "basket.read.path", "basket.add.path"]) {
    if (pick(config, path) === undefined) {
      throw retailerError(
        "NOT_CONFIGURED",
        `retailer.config.json is missing "${path}". Copy retailer.config.example.json and fill in the endpoints.`,
      );
    }
  }
}

export function retailerError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}
