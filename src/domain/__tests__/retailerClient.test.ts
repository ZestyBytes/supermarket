import { afterEach, describe, expect, it } from "vitest";
import { hasLocalServer } from "../retailerClient";

/**
 * The hosted copy on GitHub Pages has no local server behind /api. Getting
 * this wrong is not cosmetic: the panel would offer to add to a real basket
 * and then fail in a way that reads as a retailer fault.
 */
function pretendPageAt(hostname: string) {
  (globalThis as { window?: unknown }).window = { location: { hostname } };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("hasLocalServer", () => {
  it("is true for a page served by the dev server", () => {
    pretendPageAt("localhost");
    expect(hasLocalServer()).toBe(true);
    pretendPageAt("127.0.0.1");
    expect(hasLocalServer()).toBe(true);
  });

  it("is false on a static host, so the app offers planning only", () => {
    pretendPageAt("zestybytes.github.io");
    expect(hasLocalServer()).toBe(false);
  });

  it("is false for a lookalike hostname rather than matching loosely", () => {
    pretendPageAt("localhost.attacker.example");
    expect(hasLocalServer()).toBe(false);
  });

  it("is false with no window at all", () => {
    expect(hasLocalServer()).toBe(false);
  });
});
