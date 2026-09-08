#!/usr/bin/env node
import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { cookieNames, LEGACY_PATHS, saveSession, sessionPath } from "../server/session.mjs";

/**
 * Import a retailer session cookie from the shopper's own browser.
 *
 * Usage:
 *   npm run tesco:import                 paste the Cookie value at a hidden prompt
 *   npm run tesco:import -- --from-file  read it from a session file another tool wrote
 *
 * The value is written to the user's home directory and read only by the local
 * server. It is never printed back, never committed, and never sent anywhere
 * except the retailer it came from.
 */
const args = process.argv.slice(2);

async function main() {
  const fromFile = args.includes("--from-file");
  const cookie = fromFile ? readFromFile(valueAfter("--from-file")) : await promptHidden();

  if (!cookie || cookie.trim().length === 0) {
    fail("Nothing pasted — no session imported.");
  }

  const saved = saveSession(cookie.trim());
  console.log("Session imported locally.");
  console.log(`  ${saved.cookieCount} cookies · ${saved.file}`);
  console.log("  It stays on this machine. Re-run this command whenever the retailer signs you out.");
  console.log("\nNext: npm run server   (then npm run dev in a second terminal)");
}

function readFromFile(path) {
  const candidates = path ? [path] : LEGACY_PATHS;
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const raw = readFileSync(candidate, "utf8");
    try {
      const parsed = JSON.parse(raw);
      const cookie = parsed.cookie ?? parsed.Cookie ?? cookieFromPairs(parsed.cookies);
      if (cookie) {
        console.log(`Read session from ${candidate}`);
        return cookie;
      }
    } catch {
      // A plain text file holding just the header is fine too.
      if (cookieNames(raw).length > 0) return raw;
    }
  }
  fail(`No readable session file found (looked in ${candidates.join(", ")}).`);
}

/** Some tools store cookies as a list of {name, value} rather than a header. */
function cookieFromPairs(cookies) {
  if (!Array.isArray(cookies)) return null;
  return cookies
    .filter((entry) => entry?.name)
    .map((entry) => `${entry.name}=${entry.value ?? ""}`)
    .join("; ");
}

function promptHidden() {
  return new Promise((resolve) => {
    const input = process.stdin;
    const rl = createInterface({ input, output: process.stdout, terminal: true });

    process.stdout.write(
      [
        "Paste the Cookie header from your signed-in retailer tab.",
        "  DevTools → Network → any request to the retailer → Request Headers → Cookie",
        "",
        "It will not be shown as you type or paste. Press Enter when done.",
        "Cookie: ",
      ].join("\n"),
    );

    // Hide the value while it is typed or pasted.
    const wasRaw = input.isRaw;
    if (input.isTTY) input.setRawMode?.(true);
    rl.output.write = () => true;

    rl.question("", (answer) => {
      if (input.isTTY) input.setRawMode?.(wasRaw ?? false);
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main().catch((error) => {
  // Print the message only; the cause can contain the value we are protecting.
  fail(error?.message ?? "Import failed.");
});

export { sessionPath };
