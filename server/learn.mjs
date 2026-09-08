/**
 * Turn a request copied out of DevTools into retailer config.
 *
 * "Copy as cURL" on a request the retailer's own site just made is the one
 * source of truth about its API that does not involve guessing. These
 * functions read that command, template out the bits that vary, and — given a
 * real response — work out where the interesting values live in it.
 */

/** Headers that must never be copied into config: they are credentials. */
const SECRET_HEADERS = new Set(["cookie", "authorization", "x-csrf-token", "proxy-authorization"]);

/** Parse a cURL command, in either the bash (single-quote) or cmd (double-quote) flavour. */
export function parseCurl(text, { keepSecrets = false } = {}) {
  const tokens = tokenize(uncaret(String(text)).trim());

  if (tokens[0] !== "curl") throw new Error("That does not start with `curl` — copy the request as cURL.");

  const request = { method: null, url: null, headers: {}, body: null, droppedHeaders: [] };
  // Never part of the returned request unless the caller asks: the default is
  // that a parsed request cannot leak what it stripped.
  const secrets = {};

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === "-X" || token === "--request") {
      request.method = tokens[++i]?.toUpperCase() ?? null;
    } else if (token === "-H" || token === "--header") {
      const header = tokens[++i] ?? "";
      const split = header.indexOf(":");
      if (split < 0) continue;
      const name = header.slice(0, split).trim().toLowerCase();
      const value = header.slice(split + 1).trim();
      if (SECRET_HEADERS.has(name)) {
        request.droppedHeaders.push(name);
        secrets[name] = value;
      }
      else if (!name.startsWith(":")) request.headers[name] = value;
    } else if (token === "-b" || token === "--cookie") {
      request.droppedHeaders.push("cookie");
      secrets.cookie = tokens[++i] ?? "";
    } else if (token.startsWith("--data") || token === "-d") {
      request.body = tokens[++i] ?? "";
    } else if (token === "--compressed" || token.startsWith("-")) {
      // Flags we do not care about; skip a value if one obviously follows.
      if (token === "--url") request.url = tokens[++i];
    } else if (!request.url) {
      request.url = token;
    }
  }

  if (!request.url) throw new Error("No URL found in that cURL command.");
  request.method ??= request.body ? "POST" : "GET";
  return keepSecrets ? { ...request, secrets } : request;
}

/**
 * Undo Windows cmd escaping.
 *
 * "Copy as cURL (cmd)" puts a caret in front of every character cmd treats as
 * special — including the quotes themselves, so a URL arrives as
 * ^"https://xapi.tesco.com/^". Carets are stripped only when the text is
 * actually cmd-flavoured, so a bash copy containing a literal ^ is left alone.
 */
function uncaret(text) {
  const withoutContinuations = text.replace(/\\\r?\n/g, " ").replace(/\^\r?\n/g, " ");
  if (!withoutContinuations.includes('^"')) return withoutContinuations;
  return withoutContinuations.replace(/\^([\s\S])/g, "$1");
}

function tokenize(input) {
  const tokens = [];
  let current = "";
  let quote = null;
  let started = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (quote) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"' && input[i + 1]) current += input[++i];
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (current || started) tokens.push(current);
      current = "";
      started = false;
      continue;
    }
    current += char;
  }
  if (current || started) tokens.push(current);
  return tokens;
}

/**
 * Replace the values that change between calls with {placeholders}.
 *
 * The search term you used, the product you added, the quantity — those become
 * `{query}`, `{productId}` and `{qty}` wherever they appear in the path, the
 * query string or the body.
 */
export function templatize(request, samples) {
  const replacements = Object.entries(samples)
    .filter(([, value]) => value != null && String(value).length > 0)
    .map(([name, value]) => [String(value), `{${name}}`])
    // Longest first, so a value that contains another is replaced whole.
    .sort((a, b) => b[0].length - a[0].length);

  const apply = (text) => {
    if (typeof text !== "string") return text;
    let out = text;
    for (const [value, placeholder] of replacements) {
      out = out.split(value).join(placeholder);
      out = out.split(encodeURIComponent(value)).join(placeholder);
    }
    return out;
  };

  const url = new URL(request.url);
  return {
    method: request.method,
    path: apply(url.pathname + url.search),
    origin: url.origin,
    headers: request.headers,
    body: request.body ? apply(request.body) : undefined,
  };
}

/**
 * Find the list of products or basket items in a response.
 *
 * Picks the longest array of objects that look like records rather than the
 * first array encountered — retailers wrap results in several layers, some of
 * which are arrays of facets or breadcrumbs.
 */
export function inferList(payload) {
  const found = [];

  const walk = (node, path, depth) => {
    if (depth > 8 || node == null || typeof node !== "object") return;

    if (Array.isArray(node)) {
      const objects = node.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
      if (objects.length > 0) {
        found.push({ path: `${path}[]`, length: objects.length, score: scoreRecord(objects[0]) });
      }
      objects.slice(0, 3).forEach((entry, index) => walk(entry, `${path}[${index}]`, depth + 1));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      walk(value, path ? `${path}.${key}` : key, depth + 1);
    }
  };

  walk(payload, "", 0);
  if (found.length === 0) return null;

  found.sort((a, b) => b.score - a.score || b.length - a.length);
  return found[0].score > 0 ? found[0].path : null;
}

function scoreRecord(sample) {
  let score = 0;
  const flat = flatten(sample);
  if (findKey(flat, ID)) score += 2;
  if (findKey(flat, TITLE)) score += 2;
  if (findKey(flat, PRICE)) score += 2;
  if (findKey(flat, QTY)) score += 1;
  return score;
}

const ID = /^(id|productid|tpnb|tpnc|sku|baseproductid|gtin)$/i;
// Anchored, and GraphQL's own `__typename` must not read as a name.
const TITLE = /^(title|name|productname|displayname|description|label)$/i;
const PRICE = /(price|actual|value|amount)$/i;
const QTY = /(quantity|qty|count)$/i;
const SIZE = /(size|weight|volume|packsize)$/i;
const URL_KEY = /(url|link|href|slug)$/i;

/** Suggest which field in each record is the id, the title, the price and so on. */
export function inferFields(sample, kind = "search") {
  const flat = flatten(sample);
  const fields = {
    id: findKey(flat, ID),
    title: findKey(flat, TITLE),
    price: findPrice(flat),
  };

  if (kind === "search") {
    fields.size = findKey(flat, SIZE, (value) => typeof value === "string");
    fields.url = findKey(flat, URL_KEY, (value) => typeof value === "string");
  } else {
    fields.qty = findKey(flat, QTY, (value) => typeof value === "number");
  }

  return Object.fromEntries(Object.entries(fields).filter(([, path]) => path));
}

/**
 * Find what a pack costs, not what a kilo of it costs.
 *
 * Retailers put both on a product: `price.actual` is what you pay, `unitPrice`
 * is £/kg for comparing shelf labels. Picking the shallower key would take the
 * unit price and quietly cost the whole basket wrong, so anything unit-shaped
 * is excluded and a path that actually says "price" wins.
 */
function findPrice(flat) {
  const candidates = Object.entries(flat).filter(
    ([key, value]) =>
      typeof value === "number" &&
      value > 0 &&
      !/unit/i.test(key) &&
      PRICE.test(key.split(".").pop() ?? ""),
  );

  candidates.sort(
    (a, b) =>
      Number(/price/i.test(b[0])) - Number(/price/i.test(a[0])) ||
      a[0].split(".").length - b[0].split(".").length,
  );
  return candidates[0]?.[0];
}

/** Find a total-looking number outside the item list. */
export function inferTotal(payload) {
  const flat = flatten(payload, 6);
  const candidates = Object.entries(flat).filter(
    ([key, value]) => typeof value === "number" && /total|amount|value/i.test(key) && !/count|items/i.test(key),
  );
  candidates.sort((a, b) => a[0].split(".").length - b[0].split(".").length);
  return candidates[0]?.[0];
}

function flatten(value, maxDepth = 4, path = "", out = {}, depth = 0) {
  if (value == null || typeof value !== "object" || Array.isArray(value) || depth > maxDepth) {
    if (path) out[path] = value;
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, maxDepth, path ? `${path}.${key}` : key, out, depth + 1);
  }
  return out;
}

function findKey(flat, pattern, accept = () => true) {
  const matches = Object.entries(flat).filter(([key, value]) => {
    const leaf = key.split(".").pop() ?? "";
    // `__typename` and friends describe the shape, not the product.
    if (leaf.startsWith("__")) return false;
    return pattern.test(leaf) && value != null && accept(value);
  });
  // Prefer the shallowest match: `price` beats `promotions.0.price`.
  matches.sort((a, b) => a[0].split(".").length - b[0].split(".").length);
  return matches[0]?.[0];
}

/** Work out what is actually on the clipboard, so a wrong copy fails loudly. */
export function classifyClipboard(text) {
  const trimmed = String(text ?? "").trim();

  if (trimmed.length === 0) return { kind: "empty", why: "the clipboard is empty." };

  if (/^curl\b/.test(trimmed)) {
    const method = /-X\s+(\w+)|--request\s+(\w+)/.exec(trimmed);
    const url = /['"](https?:\/\/[^'"]+)['"]/.exec(trimmed) ?? /\b(https?:\/\/\S+)/.exec(trimmed);
    return {
      kind: "curl",
      method: (method?.[1] ?? method?.[2] ?? (/--data|-d\s/.test(trimmed) ? "POST" : "GET")).toUpperCase(),
      host: url ? safeHost(url[1]) : "an unknown host",
    };
  }

  // A cookie header: several name=value pairs and no shell verbs.
  if (/^[\w-]+=[^;]*;/.test(trimmed) && !/\s\|\s|Get-Clipboard|Out-File/i.test(trimmed)) {
    return { kind: "cookie", why: "it looks like a Cookie header, not a request." };
  }

  if (/Get-Clipboard|Out-File|npm run|^node\s|^git\s/i.test(trimmed)) {
    return {
      kind: "command",
      why: "it is a shell command. Copying the command replaced what you copied from DevTools.",
    };
  }

  return { kind: "unknown", why: `it starts with "${trimmed.slice(0, 40).replace(/\s+/g, " ")}…"` };
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "an unknown host";
  }
}
