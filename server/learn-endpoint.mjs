import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  inferFields,
  inferList,
  inferTotal,
  looksLikeSearch,
  mutationsIn,
  narrowToOperation,
  operationsIn,
  parseCurl,
  templatize,
  tokenLife,
} from "./learn.mjs";
import { loadSession, updateSession } from "./session.mjs";

/**
 * Turn one captured request into retailer config.
 *
 * Shared by the two front doors: `learn-endpoint` (reads a saved file) and
 * `refresh` (reads the clipboard). The retailer's token is short-lived, so the
 * less time between copying a request and using it, the better.
 */
export async function learnEndpoint({
  text,
  kind,
  term,
  productId,
  qty,
  operation,
  configFile = "retailer.config.json",
  dryRun = false,
  log = console,
}) {
  const request = parseCurl(text, { keepSecrets: true });

  const operations = operationsIn(request.body);
  if (operations.length > 0) log.log(`Operation: ${[...new Set(operations)].join(", ")}`);

  // Catch the wrong request before spending a token on it: every operation on
  // the page goes to the same endpoint, so the name is the only way to tell.
  if (kind === "search" && operations.length > 0 && !looksLikeSearch(operations)) {
    log.warn(`\nThis is the "${operations[0]}" request, not the product search.`);
    log.warn("  In DevTools, use the search icon and type a product name you can see on the page.");
    log.warn("  The request you want is the one whose RESPONSE contains the product titles.");
    log.warn("  Nothing was changed.\n");
    return { ok: false, reason: "wrong-operation", operations };
  }

  // A bearer token is a credential: it joins the session, never the config.
  // An old capture is still perfectly good for its endpoint and query — only
  // its token has gone stale — so a fresher token already in the session is
  // used rather than refusing, and never overwritten with the stale one.
  if (request.secrets?.authorization) {
    const captured = tokenLife(request.secrets.authorization);
    const held = tokenLife(loadSession()?.authorization);

    if (captured?.expired) {
      const minutes = Math.abs(Math.round(captured.secondsLeft / 60));
      if (held && !held.expired) {
        log.log(`The token in this capture expired ${minutes} minutes ago.`);
        log.log(`Using the one already in your session instead — good for another ${Math.round(held.secondsLeft / 60)} minutes.`);
      } else {
        log.warn(`\nThat token expired ${minutes} minutes ago, and your session has no fresher one.`);
        log.warn("  Reload the page, redo the action, and copy the request again.");
        log.warn("  Nothing was changed.\n");
        return { ok: false, reason: "expired", operations };
      }
    } else {
      if (captured) log.log(`Token is good for another ${Math.round(captured.secondsLeft / 60)} minutes.`);
      try {
        updateSession({ authorization: request.secrets.authorization });
        log.log("Stored a fresh authorization token with your session (not in config).");
      } catch (error) {
        log.warn(`Could not store the authorization token: ${error.message}`);
      }
    }
  }
  if (request.secrets?.cookie) {
    try {
      updateSession({ cookie: request.secrets.cookie });
      log.log("Refreshed the session cookie too.");
    } catch {
      /* no session to merge into yet */
    }
  }

  const spec = templatize(request, { query: term, productId, qty });
  log.log(`${spec.method} ${spec.origin}${spec.path}`);

  const templated = `${spec.path}${spec.body ?? ""}`.includes("{query}");
  if (kind === "search" && !templated) {
    reportMissingTerm(request, term, log);
  }

  const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, "utf8")) : { retailer: "tesco" };
  config.baseUrl = spec.origin;
  config.headers = { ...(config.headers ?? {}), ...keepUsefulHeaders(spec.headers) };

  const entry = { method: spec.method, path: spec.path };

  // Store only the operation being learned. The capture may batch it with
  // others — including mutations that would change the basket every time it
  // is read.
  let body = operation ? narrowToOperation(spec.body, operation) : spec.body;
  if (kind !== "basket-add") {
    const mutations = mutationsIn(body);
    if (mutations.length > 0) {
      log.warn(`\nRefusing to store this: it carries the mutation ${mutations.join(", ")}, which changes your basket.`);
      log.warn("  A read must not have side effects. Capture the request again without that action.\n");
      return { ok: false, reason: "carries-mutation", operations };
    }
  }
  if (body) entry.body = body;

  let outcome = { ok: false };

  if (kind === "basket-add") {
    config.basket = { ...(config.basket ?? {}), add: entry };
    log.log("Recorded the add-to-basket request. It was not replayed — configuring must not buy anything.");
    outcome = { ok: true, replayed: false };
  } else {
    const payload = await replay({ ...spec, body }, log);
    if (payload) {
      const list = inferList(payload);
      if (!list) {
        log.warn("\nCould not find a list of records in the response.");
        describeResponse(payload, log);
        outcome = { ok: false, reason: reasonFor(payload) };
      } else {
        entry.results = list;
        entry.fields = inferFields(sampleFrom(payload, list), kind === "search" ? "search" : "basket");
        log.log(`Found ${list}`);
        log.log(`Fields: ${JSON.stringify(entry.fields)}`);
        if (kind === "basket-read") {
          entry.total = inferTotal(payload);
          if (entry.total) log.log(`Basket total: ${entry.total}`);
        }
        outcome = { ok: true, replayed: true, list, fields: entry.fields };
      }
    } else {
      outcome = { ok: false, reason: "no-response" };
    }

    if (kind === "search") config.search = entry;
    else config.basket = { ...(config.basket ?? {}), read: entry };
  }

  if (dryRun) {
    log.log(JSON.stringify(config, null, 2));
  } else {
    writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
    log.log(`Wrote ${configFile}`);
  }

  return outcome;
}

async function replay(spec, log) {
  const session = loadSession();
  if (!session) {
    log.warn("No session imported, so the request was not replayed. Run: npm run tesco:import");
    return null;
  }

  try {
    const response = await fetch(new URL(spec.path, spec.origin), {
      method: spec.method,
      headers: {
        ...spec.headers,
        accept: "application/json",
        ...(session.cookie ? { cookie: session.cookie } : {}),
        ...(session.authorization ? { authorization: session.authorization } : {}),
      },
      body: spec.body,
      redirect: "manual",
    });

    if (response.status === 401 || response.status === 403) {
      log.warn(`The retailer rejected the session (${response.status}). Capture the request again.`);
      return null;
    }
    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      log.warn(`Response was not JSON (${response.status}) — usually a sign-in wall.`);
      return null;
    }
  } catch (error) {
    log.warn(`Could not replay the request: ${error.message}`);
    return null;
  }
}

/**
 * Say what came back, when no products could be found in it.
 *
 * A shop with no matches and an API that refused the request look identical
 * once inference fails, so the difference gets printed. GraphQL reports
 * refusals in `errors` and still answers 200.
 */
function describeResponse(payload, log) {
  const errors = errorsIn(payload);

  if (errors.length > 0) {
    log.warn("  The retailer returned errors, not data:");
    for (const error of errors.slice(0, 3)) {
      const code = error?.extensions?.code ? ` [${error.extensions.code}]` : "";
      log.warn(`    ${String(error?.message ?? error).slice(0, 160)}${code}`);
    }
    return;
  }

  const root = Array.isArray(payload) ? payload[0] : payload;
  log.warn(
    `  Top-level shape: ${Array.isArray(payload) ? `array of ${payload.length}` : "object"}, keys: ${Object.keys(
      root ?? {},
    )
      .slice(0, 8)
      .join(", ")}`,
  );
  log.warn(`  First 300 characters: ${JSON.stringify(payload).slice(0, 300)}`);
}

function errorsIn(payload) {
  const root = Array.isArray(payload) ? payload[0] : payload;
  const errors = root?.errors ?? payload?.errors;
  return Array.isArray(errors) ? errors : [];
}

/** Classify a failed learn, so the caller can say what to do next. */
export function reasonFor(payload) {
  const errors = errorsIn(payload);
  if (errors.length === 0) return "unknown-shape";
  const text = JSON.stringify(errors).slice(0, 2000);
  return /unauthenticated|unauthor|forbidden|token|expired/i.test(text) ? "expired" : "retailer-error";
}

function reportMissingTerm(request, term, log) {
  log.warn(`\nWarning: "${term ?? "(no term given)"}" was not found in that request, so nothing was templated.`);
  log.warn(`  Request body: ${request.body ? `${request.body.length} characters` : "none captured"}`);
  if (!request.body) return;

  const seen = [...request.body.matchAll(/"(?:query|searchTerm|term|q)"\s*:\s*"([^"]{1,60})"/g)]
    .map((match) => match[1])
    .filter((value) => !value.includes("{") && value.length < 40);

  if (seen.length > 0) {
    log.warn(`  The body searches for: ${[...new Set(seen)].map((value) => `"${value}"`).join(", ")}`);
    log.warn("  Run it again with a term matching one of those exactly.");
  } else {
    log.warn("  No search-term-shaped field found in the body. Is this the right request?");
  }
  log.warn("");
}

function sampleFrom(payload, listPath) {
  let node = payload;
  for (const step of listPath.replace(/\[\]$/, "").split(".")) {
    if (!step) continue;
    const indexed = /^(.*)\[(\d+)\]$/.exec(step);
    if (indexed) {
      const list = indexed[1] ? node?.[indexed[1]] : node;
      node = Array.isArray(list) ? list[Number(indexed[2])] : undefined;
      continue;
    }
    node = node?.[step];
  }
  return Array.isArray(node) ? node[0] : (node ?? {});
}

/**
 * Keep the headers the API needs; drop only noise.
 *
 * An allowlist threw away the custom headers these APIs require — an x-apikey,
 * a trace id — leaving requests that fail for no visible reason. Credentials
 * are already gone: parseCurl strips them before this runs.
 */
function keepUsefulHeaders(headers) {
  // Origin and referer stay: an API gateway fronting a browser app often
  // checks them, and dropping them reads as an unauthenticated request.
  const drop = /^(host|connection|content-length|sec-|:|accept-encoding|priority|cookie|authorization)/i;
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !drop.test(name)));
}
