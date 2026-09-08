#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { inferFields, inferList, inferTotal, parseCurl, templatize } from "../server/learn.mjs";
import { loadSession } from "../server/session.mjs";

/**
 * Build retailer.config.json from requests the retailer's own site made.
 *
 * In DevTools → Network, right-click the request → Copy → Copy as cURL, save
 * it to a file, then:
 *
 *   node scripts/learn-endpoint.mjs --kind search      --term chicken     --file search.txt
 *   node scripts/learn-endpoint.mjs --kind basket-read                    --file basket.txt
 *   node scripts/learn-endpoint.mjs --kind basket-add  --product-id 12345 --qty 1 --file add.txt
 *
 * Run it with node, not `npm run`: npm parses unknown --flags as its own
 * config and they never reach the script.
 *
 * Search and basket-read are replayed once with your imported session so the
 * response shape can be read from real data. basket-add is never replayed —
 * that would add something to your basket as a side effect of configuring.
 */
const CONFIG = process.env.RETAILER_CONFIG ?? "retailer.config.json";
const args = process.argv.slice(2);

const kind = flag("--kind");
const file = flag("--file");
const dryRun = args.includes("--dry-run");

// npm swallows unknown --flags before the script sees them, so this must be
// run directly with node rather than through `npm run`.
if (!kind || !file) {
  fail(
    [
      "Run this with node directly — npm eats the flags:",
      "",
      "  node scripts/learn-endpoint.mjs --kind search      --term chicken --file search.txt",
      "  node scripts/learn-endpoint.mjs --kind basket-read                --file basket.txt",
      "  node scripts/learn-endpoint.mjs --kind basket-add  --product-id 12345 --qty 1 --file add.txt",
    ].join("\n"),
  );
}
if (!["search", "basket-read", "basket-add"].includes(kind)) {
  fail(`--kind must be search, basket-read or basket-add (got "${kind}")`);
}
if (!existsSync(file)) fail(`No file at ${file}`);

const request = parseCurl(readFileSync(file, "utf8"));
const spec = templatize(request, {
  query: flag("--term"),
  productId: flag("--product-id"),
  qty: flag("--qty"),
  limit: flag("--limit"),
});

if (request.droppedHeaders.length > 0) {
  console.log(`Dropped ${request.droppedHeaders.join(", ")} — credentials never go in config.`);
}
console.log(`${spec.method} ${spec.origin}${spec.path}`);

if (kind === "search" && !spec.path.includes("{query}")) {
  console.warn(
    `Warning: "${flag("--term") ?? "(no --term given)"}" was not found in that request, so nothing was templated.\n` +
      "Pass --term with the exact word you searched for.",
  );
}

const config = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, "utf8")) : { retailer: "tesco" };
config.baseUrl = spec.origin;
config.headers = { ...(config.headers ?? {}), ...pickSafeHeaders(spec.headers) };

const entry = { method: spec.method, path: spec.path };
if (spec.body) entry.body = spec.body;

if (kind === "basket-add") {
  config.basket = { ...(config.basket ?? {}), add: entry };
  console.log("Recorded the add-to-basket request. It was not replayed.");
} else {
  const payload = await replay(spec);
  if (payload) {
    const list = inferList(payload);
    if (!list) {
      console.warn("Could not find a list of records in the response. Fill in `results` and `fields` by hand.");
    } else {
      entry.results = list;
      entry.fields = inferFields(sampleFrom(payload, list), kind === "search" ? "search" : "basket");
      console.log(`Found ${list} with fields: ${JSON.stringify(entry.fields, null, 2)}`);
    }
    if (kind === "basket-read") {
      entry.total = inferTotal(payload);
      if (entry.total) console.log(`Basket total looks like: ${entry.total}`);
    }
  }
  if (kind === "search") config.search = entry;
  else config.basket = { ...(config.basket ?? {}), read: entry };
}

if (dryRun) {
  console.log(JSON.stringify(config, null, 2));
} else {
  writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Wrote ${CONFIG}`);
}

async function replay(spec) {
  const session = loadSession();
  if (!session) {
    console.warn("No session imported, so the request was not replayed. Run: npm run tesco:import");
    return null;
  }
  try {
    const response = await fetch(new URL(spec.path, spec.origin), {
      method: spec.method,
      headers: { ...spec.headers, cookie: session.cookie, accept: "application/json" },
      body: spec.body,
      redirect: "manual",
    });
    if (response.status === 401 || response.status === 403) {
      console.warn("The retailer rejected the session. Re-import it and try again.");
      return null;
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      console.warn(`Response was not JSON (${response.status}). Is the session still signed in?`);
      return null;
    }
  } catch (error) {
    console.warn(`Could not replay the request: ${error.message}`);
    return null;
  }
}

function sampleFrom(payload, listPath) {
  let node = payload;
  for (const step of listPath.replace(/\[\]$/, "").split(".")) {
    if (!step) continue;
    node = node?.[step];
  }
  return Array.isArray(node) ? node[0] : {};
}

/** Keep the headers that shape the response; drop the noise and anything secret. */
function pickSafeHeaders(headers) {
  const keep = ["accept", "accept-language", "content-type", "x-requested-with", "user-agent"];
  return Object.fromEntries(Object.entries(headers).filter(([name]) => keep.includes(name)));
}

function flag(name) {
  const index = args.indexOf(name);
  const value = args[index + 1];
  return index > -1 && value && !value.startsWith("--") ? value : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
