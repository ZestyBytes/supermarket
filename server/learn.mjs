/**
 * Turn a request copied out of DevTools into retailer config.
 *
 * "Copy as cURL" on a request the retailer's own site just made is the one
 * source of truth about its API that does not involve guessing. These
 * functions read that command, template out the bits that vary, and, given a
 * real response, work out where the interesting values live in it.
 */

/** Headers that must never be copied into config: they are credentials. */
const SECRET_HEADERS = new Set(["cookie", "authorization", "x-csrf-token", "proxy-authorization"]);

/** Parse a cURL command, in either the bash (single-quote) or cmd (double-quote) flavour. */
export function parseCurl(text, { keepSecrets = false } = {}) {
  const tokens = tokenize(uncaret(String(text)).trim());

  if (tokens[0] !== "curl") throw new Error("That does not start with `curl`. Copy the request as cURL.");

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
 * special, including the quotes themselves, so a URL arrives as
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
 * The search term you used, the product you added, the quantity: those become
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
 * first array encountered, because retailers wrap results in several layers, some of
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

/**
 * How long a bearer token has left.
 *
 * These are JWTs: the middle segment is base64url JSON carrying `exp`. Reading
 * it locally turns "Unauthorized", which arrives long after the mistake, into
 * "this expired 20 minutes ago", before a request is even sent. Only the
 * timestamps are read; the token is never logged.
 */
export function tokenLife(authorization, now = Date.now()) {
  if (typeof authorization !== "string") return null;
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  const segments = jwt.split(".");
  if (segments.length !== 3) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims?.exp !== "number") return null;

  const expiresAt = new Date(claims.exp * 1000);
  const secondsLeft = Math.round((expiresAt.getTime() - now) / 1000);
  return {
    expiresAt,
    secondsLeft,
    expired: secondsLeft <= 0,
    lifetimeSeconds: typeof claims.iat === "number" ? claims.exp - claims.iat : undefined,
  };
}

/**
 * Which GraphQL operations a request carries.
 *
 * A retailer's page fires several: the product search, recommendations,
 * suggestions. They all go to the same endpoint, so the only way to tell the
 * captured one apart is by name.
 */
export function operationsIn(body) {
  if (typeof body !== "string") return [];
  return [...body.matchAll(/"operationName"\s*:\s*"([^"]+)"/g)].map((match) => match[1]);
}

/** Does this request look like the one that searches for products? */
export function looksLikeSearch(operations) {
  return operations.some((name) => /^search$/i.test(name) || /productsearch|searchproducts/i.test(name));
}

/**
 * Split a "Copy all as cURL" paste into individual commands.
 *
 * DevTools can copy every request in the list at once, which is far easier
 * than identifying one row by eye among hundreds of analytics calls.
 */
export function splitCurls(text) {
  return String(text)
    .split(/\r?\n(?=curl\s)/)
    .map((command) => command.trim())
    .filter((command) => /^curl\s/.test(command));
}

const WANTED = {
  search: [/^search$/i, /productsearch|searchproducts/i],
  "basket-read": [/^(get)?(basket|trolley)$/i, /basket|trolley/i],
  "basket-add": [/add.*(basket|trolley)|(basket|trolley).*add|updatebasket|changebasket/i],
};

/**
 * Find the one request that does the job, among everything the page fired.
 *
 * A retailer page posts dozens of operations to the same endpoint:
 * recommendations, analytics and taxonomy, so the operation name is what tells
 * them apart. Returns the chosen command, or the candidates when the choice
 * is not obvious enough to make automatically.
 */
export function pickRequest(commands, kind, preferred, { term } = {}) {
  const parsed = commands.map((command) => {
    let request = null;
    try {
      request = parseCurl(command);
    } catch {
      /* not a request we can read */
    }
    return { command, request, operations: operationsIn(request?.body) };
  });

  const usable = parsed.filter((entry) => entry.request);
  if (usable.length === 0) return { ok: false, reason: "none-parsed", seen: [] };
  if (usable.length === 1 && usable[0].operations.length === 0) {
    return { ok: true, command: usable[0].command, operation: null };
  }

  // The search request is the one carrying the word you typed *as its query*.
  // Matching the word anywhere is too loose: a recommendations call lists the
  // search term among the products it should exclude, and would win.
  if (term && !preferred) {
    const asQuery = new RegExp(`"(?:query|searchTerm|term|q)"\\s*:\\s*"${escapeRegex(term)}"`, "i");
    const carrying = usable.filter((entry) => asQuery.test(entry.request.body ?? ""));
    if (carrying.length === 1) {
      return { ok: true, command: carrying[0].command, operation: carrying[0].operations[0] ?? null };
    }
    if (carrying.length > 1) {
      const preferredByName = carrying.filter((entry) =>
        (WANTED[kind] ?? []).some((pattern) => entry.operations.some((name) => pattern.test(name))),
      );
      const winner = preferredByName[0] ?? carrying[0];
      return { ok: true, command: winner.command, operation: winner.operations[0] ?? null };
    }
  }

  if (preferred) {
    const exact = usable.find((entry) => entry.operations.some((name) => name.toLowerCase() === preferred.toLowerCase()));
    if (exact) return { ok: true, command: exact.command, operation: preferred };
    return { ok: false, reason: "no-such-operation", seen: names(usable) };
  }

  for (const pattern of WANTED[kind] ?? []) {
    const matches = usable.filter((entry) => entry.operations.some((name) => pattern.test(name)));
    if (matches.length === 1) {
      return { ok: true, command: matches[0].command, operation: matches[0].operations.find((n) => pattern.test(n)) };
    }
    if (matches.length > 1) {
      return { ok: false, reason: "ambiguous", seen: names(matches) };
    }
  }

  return { ok: false, reason: "not-found", seen: names(usable) };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function names(entries) {
  return [...new Set(entries.flatMap((entry) => entry.operations))].sort();
}

/**
 * Keep only the operation we actually want from a batched request.
 *
 * A retailer batches unrelated operations into one POST: reading a basket
 * arrives alongside a mutation that *changes* it. Storing the batch verbatim
 * would mean every basket read replays that mutation, silently editing the
 * basket as a side effect of looking at it.
 */
export function narrowToOperation(body, operationName) {
  if (typeof body !== "string" || !operationName) return body;

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  if (!Array.isArray(parsed)) return body;

  const kept = parsed.filter((entry) => entry?.operationName === operationName);
  return kept.length > 0 ? JSON.stringify(kept) : body;
}

/** Operations that change something, and must never end up in a read. */
export function mutationsIn(body) {
  if (typeof body !== "string") return [];
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  return entries
    .filter((entry) => typeof entry?.query === "string" && /^\s*mutation\b/.test(entry.query))
    .map((entry) => entry.operationName ?? "(unnamed)");
}
