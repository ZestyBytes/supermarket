import { afterEach, describe, expect, it } from "vitest";
import { isLoopbackPage } from "../retailerClient";

/**
 * Wording only. Whether a local server is actually there is settled by asking
 * it: a phone reaching the dev server across the house is not a loopback
 * page, but the /api proxy still lands on a real server.
 */
function pretendPageAt(hostname: string) {
  (globalThis as { window?: unknown }).window = { location: { hostname } };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("isLoopbackPage", () => {
  it("is true for a page served by the dev server", () => {
    pretendPageAt("localhost");
    expect(isLoopbackPage()).toBe(true);
    pretendPageAt("127.0.0.1");
    expect(isLoopbackPage()).toBe(true);
  });

  it("is false on a static host", () => {
    pretendPageAt("zestybytes.github.io");
    expect(isLoopbackPage()).toBe(false);
  });

  it("is false for a lookalike hostname rather than matching loosely", () => {
    pretendPageAt("localhost.attacker.example");
    expect(isLoopbackPage()).toBe(false);
  });

  it("is false with no window at all", () => {
    expect(isLoopbackPage()).toBe(false);
  });
});
