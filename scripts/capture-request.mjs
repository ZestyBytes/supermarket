#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { readClipboard } from "../server/clipboard.mjs";
import { classifyClipboard } from "../server/learn.mjs";

/**
 * Capture a request from DevTools without the clipboard dance going wrong.
 *
 *   npm run capture -- search.txt
 *
 * Start this FIRST, then copy the request in DevTools, then press Enter. Doing
 * it in that order matters: copying anything else, including the command you
 * were told to run, replaces what is on the clipboard, and the file ends up
 * holding the wrong thing entirely.
 */
const target = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

if (!target) {
  console.error("Usage: npm run capture -- search.txt");
  process.exit(1);
}

console.log(`Ready to capture into ${target}.`);
console.log("");
console.log("  1. In your browser: DevTools → Network");
console.log("  2. Right-click the request → Copy → Copy as cURL");
console.log("  3. Come back here and press Enter");
console.log("");
console.log("Copy nothing else in between. The last thing you copy is what gets saved.");

await waitForEnter();

let clipboard;
try {
  clipboard = readClipboard();
} catch (error) {
  console.error(`Could not read the clipboard: ${error.message}`);
  console.error(`Paste the request into ${target} by hand instead.`);
  process.exit(1);
}

const verdict = classifyClipboard(clipboard);

if (verdict.kind === "curl") {
  writeFileSync(target, clipboard, "utf8");
  console.log(`\nSaved ${clipboard.length} characters to ${target}.`);
  console.log(`It is a ${verdict.method} request to ${verdict.host}.`);
  console.log("\nThat file contains your session cookie. Delete it once the endpoint is learned.");
} else {
  console.error(`\nThat is not a cURL command. ${verdict.why}`);
  if (verdict.kind === "cookie") {
    console.error("It looks like a cookie header. To import it as a session instead:");
    console.error("  npm run tesco:import");
    console.error("  (then paste it at the prompt)");
  }
  console.error("\nNothing was saved. Copy the request in DevTools and run this again.");
  process.exit(1);
}




function waitForEnter() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Press Enter once the request is copied… ", () => {
      rl.close();
      resolve();
    });
  });
}
