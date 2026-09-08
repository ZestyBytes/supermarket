import { afterEach, describe, expect, it, vi } from "vitest";
import { newAttemptId } from "../ids";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const real = globalThis.crypto;

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(globalThis, "crypto", { value: real, configurable: true, writable: true });
});

function withCrypto(value: unknown) {
  Object.defineProperty(globalThis, "crypto", { value, configurable: true, writable: true });
}

describe("newAttemptId", () => {
  it("uses randomUUID where it exists", () => {
    expect(newAttemptId()).toMatch(UUID);
  });

  it("still works with no randomUUID — a phone on plain HTTP over the LAN", () => {
    withCrypto({ getRandomValues: real.getRandomValues.bind(real) });
    const id = newAttemptId();
    expect(id).toMatch(UUID);
    expect(id[14]).toBe("4");
  });

  it("still returns something with no crypto at all, rather than throwing", () => {
    withCrypto(undefined);
    expect(newAttemptId().length).toBeGreaterThan(8);
  });

  it("does not repeat itself", () => {
    withCrypto({ getRandomValues: real.getRandomValues.bind(real) });
    const seen = new Set(Array.from({ length: 200 }, newAttemptId));
    expect(seen.size).toBe(200);
  });
});
