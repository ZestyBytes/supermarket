import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

/**
 * The retailer session — a browser cookie the shopper pasted in themselves.
 *
 * It carries the full weight of a logged-in account, so it lives in the user's
 * home directory, never in the repo, and never in a log line. The browser
 * never sees it either: only this local server reads the file.
 */
const DEFAULT_PATH = join(homedir(), ".supermarket", "tesco-session.json");

/** Session files written by other tools, offered as an import source. */
export const LEGACY_PATHS = [join(homedir(), ".tesco", "session.json")];

export function sessionPath() {
  return process.env.SUPERMARKET_SESSION_FILE || DEFAULT_PATH;
}

export function saveSession(cookie, { retailer = "tesco", file = sessionPath(), authorization } = {}) {
  const names = cookieNames(cookie);
  if (names.length === 0) {
    throw new Error("That does not look like a Cookie header — expected name=value pairs separated by ';'.");
  }

  const record = {
    retailer,
    importedAt: new Date().toISOString(),
    cookieCount: names.length,
    cookieNames: names,
    cookie,
    // Some retailers authenticate the API with a bearer token rather than the
    // cookie. It is the same kind of secret, so it lives in the same place.
    ...(authorization ? { authorization } : {}),
  };

  mkdirSync(dirname(file), { recursive: true });
  // Replace the file outright rather than re-permissioning one that exists.
  // Repairing in place is what made an earlier session file unopenable
  // without an Administrator takeown.
  if (existsSync(file)) rmSync(file, { force: true });
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });

  // chmod is meaningful on POSIX only; on Windows it just toggles the
  // read-only flag, which is the trap above. The user profile directory
  // already restricts access there.
  if (platform() !== "win32") chmodSync(file, 0o600);

  return { ...record, cookie: undefined, file };
}

export function loadSession({ file = sessionPath() } = {}) {
  try {
    const record = JSON.parse(readFileSync(file, "utf8"));
    return record?.cookie ? record : null;
  } catch {
    return null;
  }
}

/** Merge fields into the stored session, keeping what is already there. */
export function updateSession(patch, { file = sessionPath() } = {}) {
  const current = loadSession({ file });
  if (!current) throw new Error("No session imported yet — run: npm run tesco:import");
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  if (platform() !== "win32") chmodSync(file, 0o600);
  return { ...next, cookie: undefined, authorization: undefined };
}

export function forgetSession({ file = sessionPath() } = {}) {
  rmSync(file, { force: true });
}

/** Session details safe to send to the browser: everything but the cookie. */
export function describeSession(record) {
  if (!record) return { present: false };
  return {
    present: true,
    retailer: record.retailer,
    importedAt: record.importedAt,
    cookieCount: record.cookieCount ?? cookieNames(record.cookie).length,
    hasAuthorization: Boolean(record.authorization),
    ageHours: Math.round(((Date.now() - Date.parse(record.importedAt)) / 3_600_000) * 10) / 10,
  };
}

export function cookieNames(cookie) {
  if (typeof cookie !== "string") return [];
  return cookie
    .split(";")
    .map((pair) => pair.trim().split("=")[0])
    .filter((name) => name.length > 0 && !name.includes(" "));
}

/** Strip anything cookie-shaped out of text bound for a log or an error. */
export function redact(text, cookie) {
  if (!cookie || typeof text !== "string") return text;
  return text.split(cookie).join("[session redacted]");
}
