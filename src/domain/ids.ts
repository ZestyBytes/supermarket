/**
 * An id for one basket submission, used to stop a retry adding the week twice.
 *
 * `crypto.randomUUID` exists only in a secure context: HTTPS, or localhost.
 * The phone-on-the-sofa setup is neither: it reaches the dev server over plain
 * HTTP at something like http://192.168.1.42:5173, where the property is
 * simply absent and calling it throws during render, blanking the whole page.
 *
 * `getRandomValues` carries no such restriction, so it does the work wherever
 * it exists. The last resort is not cryptographically random, and does not
 * need to be: this value is only ever compared against the one sent moments
 * ago, never used as a secret.
 */
export function newAttemptId(): string {
  const c: Crypto | undefined = globalThis.crypto;

  if (typeof c?.randomUUID === "function") return c.randomUUID();

  if (typeof c?.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}
