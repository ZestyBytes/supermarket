import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveSession } from "../session.mjs";
import { learnEndpoint } from "../learn-endpoint.mjs";

/** A JWT with the given lifetime, signed with nothing — only the claims matter. */
function token(secondsFromNow) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `Bearer ${encode({ alg: "RS256" })}.${encode({ iat: now - 60, exp: now + secondsFromNow })}.sig`;
}

function capture(authorization) {
  return [
    'curl --url "https://xapi.example/"',
    `-H "authorization: ${authorization}"`,
    '-H "content-type: application/json"',
    '--data-raw "[{\\"operationName\\":\\"Search\\",\\"variables\\":{\\"query\\":\\"chicken\\"}}]"',
  ].join(" ");
}

describe("a capture whose token has gone stale", () => {
  let sessionFile;
  let configFile;
  const quiet = { log: () => {}, warn: () => {} };

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "supermarket-stale-"));
    sessionFile = join(dir, "session.json");
    configFile = join(dir, "retailer.config.json");
    process.env.SUPERMARKET_SESSION_FILE = sessionFile;
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify([{ data: { search: { results: [{ node: { id: "1", title: "Chicken 650G", price: { actual: 4.9 } } } ] } } }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    delete process.env.SUPERMARKET_SESSION_FILE;
    vi.unstubAllGlobals();
  });

  it("uses the fresher token from the session rather than refusing", async () => {
    // The endpoint and query in an old capture are still correct; only the
    // credential has aged out. Refusing would throw away a good capture.
    saveSession("sessionId=abc", { file: sessionFile, authorization: token(3600) });

    const outcome = await learnEndpoint({
      text: capture(token(-600)),
      kind: "search",
      term: "chicken",
      configFile,
      log: quiet,
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.list).toBe("[0].data.search.results[]");
  });

  it("never overwrites a good session token with a stale one", async () => {
    const good = token(3600);
    saveSession("sessionId=abc", { file: sessionFile, authorization: good });

    await learnEndpoint({ text: capture(token(-600)), kind: "search", term: "chicken", configFile, log: quiet });

    const { loadSession } = await import("../session.mjs");
    expect(loadSession({ file: sessionFile }).authorization).toBe(good);
  });

  it("still refuses when nothing anywhere is usable", async () => {
    saveSession("sessionId=abc", { file: sessionFile, authorization: token(-900) });

    const outcome = await learnEndpoint({
      text: capture(token(-600)),
      kind: "search",
      term: "chicken",
      configFile,
      log: quiet,
    });

    expect(outcome).toMatchObject({ ok: false, reason: "expired" });
  });
});
