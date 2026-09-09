#!/usr/bin/env node
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { existsSync, readFileSync } from "node:fs";
import { cookieNames, LEGACY_PATHS, saveSession } from "../server/session.mjs";

/**
 * Import a retailer session cookie from the shopper's own browser.
 *
 *   npm run tesco:import                          paste at a hidden prompt
 *   npm run tesco:import -- <path to session>     read from a file another tool wrote
 *   Get-Clipboard | npm run tesco:import          pipe it in (PowerShell)
 *   pbpaste | npm run tesco:import                pipe it in (macOS)
 *
 * Note the plain path rather than a --flag: npm consumes unknown flags before
 * the script ever sees them, so this takes its file argument positionally.
 *
 * The value is written to the user's home directory and read only by the local
 * server. It is never printed back, never committed, and never sent anywhere
 * except the retailer it came from.
 */
const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

async function main() {
  const cookie = await readCookie();

  if (!cookie || cookie.trim().length === 0) {
    fail("Nothing pasted, so no session imported.");
  }

  const saved = saveSession(cookie.trim());
  console.log("\nSession imported locally.");
  console.log(`  ${saved.cookieCount} cookies · ${saved.file}`);
  console.log("  It stays on this machine. Re-run this whenever the retailer signs you out.");
  console.log("\nNext: npm run server   (then npm run dev in a second terminal)");
}

async function readCookie() {
  // A path was given, or a known session file from another tool exists.
  const explicit = args[0];
  if (explicit || !process.stdin.isTTY) {
    if (explicit) return readFromFile(explicit);
  }
  // Piped in: Get-Clipboard | npm run tesco:import
  if (!process.stdin.isTTY) return readStdin();

  const legacy = LEGACY_PATHS.find((path) => existsSync(path));
  if (legacy) {
    console.log(`Found an existing session file at ${legacy}.`);
    console.log("Reading from it. To paste a fresh cookie instead, delete that file first.\n");
    return readFromFile(legacy);
  }

  return promptHidden();
}

function readFromFile(path) {
  if (!existsSync(path)) fail(`No file at ${path}`);
  const raw = readFileSync(path, "utf8");

  try {
    const parsed = JSON.parse(raw);
    const cookie = parsed.cookie ?? parsed.Cookie ?? cookieFromPairs(parsed.cookies);
    if (cookie) {
      console.log(`Read session from ${path}`);
      return cookie;
    }
    fail(`${path} is JSON but has no cookie in it (looked for "cookie" and "cookies").`);
  } catch (error) {
    if (error?.exitCode) throw error;
    // A plain text file holding just the header is fine too.
    if (cookieNames(raw).length > 0) {
      console.log(`Read session from ${path}`);
      return raw;
    }
    fail(`${path} does not contain a cookie header.`);
  }
}

/** Some tools store cookies as a list of {name, value} rather than a header. */
function cookieFromPairs(cookies) {
  if (!Array.isArray(cookies)) return null;
  return cookies
    .filter((entry) => entry?.name)
    .map((entry) => `${entry.name}=${entry.value ?? ""}`)
    .join("; ");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Prompt without echoing.
 *
 * The output stream is muted rather than the terminal put into raw mode:
 * raw mode swallows the paste on Windows terminals, which is how an earlier
 * version managed to exit having read nothing at all.
 */
function promptHidden() {
  return new Promise((resolve) => {
    console.log("Paste the Cookie header from your signed-in retailer tab.");
    console.log("  DevTools → Network → any request to the retailer → Request Headers → Cookie");
    console.log("\nIt will not be shown as you paste. Press Enter when done.");

    let muted = false;
    const output = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) process.stdout.write(chunk, encoding);
        callback();
      },
    });

    const rl = createInterface({ input: process.stdin, output, terminal: true });
    rl.question("Cookie: ", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main().catch((error) => {
  // Print the message only; a cause can carry the value we are protecting.
  fail(error?.message ?? "Import failed.");
});
