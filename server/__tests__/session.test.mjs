import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cookieNames, describeSession, forgetSession, loadSession, redact, saveSession } from "../session.mjs";

function tempFile() {
  return join(mkdtempSync(join(tmpdir(), "supermarket-")), "session.json");
}

const COOKIE = "sessionId=abc123; _csrf=zzz; consent=yes";

describe("saveSession", () => {
  it("round-trips a cookie through the file", () => {
    const file = tempFile();
    saveSession(COOKIE, { file });
    expect(loadSession({ file })?.cookie).toBe(COOKIE);
  });

  it("never returns the cookie to its caller", () => {
    const saved = saveSession(COOKIE, { file: tempFile() });
    expect(saved.cookie).toBeUndefined();
    expect(saved.cookieCount).toBe(3);
  });

  it("replaces an existing file rather than editing it in place", () => {
    // Re-permissioning a file that already exists is what previously locked
    // the session out and needed an Administrator repair.
    const file = tempFile();
    saveSession(COOKIE, { file });
    saveSession("sessionId=second; other=1", { file });
    expect(loadSession({ file })?.cookie).toBe("sessionId=second; other=1");
    expect(JSON.parse(readFileSync(file, "utf8")).cookieCount).toBe(2);
  });

  it("rejects something that is not a cookie header", () => {
    expect(() => saveSession("   ", { file: tempFile() })).toThrow(/does not look like a Cookie header/);
  });

  it("forgets on request", () => {
    const file = tempFile();
    saveSession(COOKIE, { file });
    forgetSession({ file });
    expect(loadSession({ file })).toBeNull();
  });

  it("treats a corrupt file as no session at all", () => {
    const file = tempFile();
    writeFileSync(file, "not json");
    expect(loadSession({ file })).toBeNull();
  });
});

describe("describeSession", () => {
  it("describes the session without exposing it", () => {
    const description = describeSession(loadSessionFrom(COOKIE));
    expect(description).toMatchObject({ present: true, cookieCount: 3 });
    expect(JSON.stringify(description)).not.toContain("abc123");
  });

  it("reports absence plainly", () => {
    expect(describeSession(null)).toEqual({ present: false });
  });
});

describe("redact", () => {
  it("strips the cookie out of anything bound for a log", () => {
    expect(redact(`failed with ${COOKIE} attached`, COOKIE)).toBe("failed with [session redacted] attached");
  });
});

describe("cookieNames", () => {
  it("lists names without values", () => {
    expect(cookieNames(COOKIE)).toEqual(["sessionId", "_csrf", "consent"]);
  });

  it("returns nothing for junk", () => {
    expect(cookieNames("")).toEqual([]);
    expect(cookieNames(undefined)).toEqual([]);
  });
});

function loadSessionFrom(cookie) {
  const file = tempFile();
  saveSession(cookie, { file });
  return loadSession({ file });
}
