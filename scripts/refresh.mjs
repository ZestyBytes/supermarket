#!/usr/bin/env node
import { createInterface } from "node:readline";
import { readClipboard } from "../server/clipboard.mjs";
import { classifyClipboard } from "../server/learn.mjs";
import { learnEndpoint } from "../server/learn-endpoint.mjs";

/**
 * Capture a request and learn from it in one go.
 *
 * The retailer's token is short-lived — minutes, not hours — so a capture that
 * sits in a file while you run a second command is often already dead. This
 * copies from the clipboard and uses it immediately.
 *
 *   npm run refresh -- search chicken
 *   npm run refresh -- basket
 *   npm run refresh -- add 254656732 1
 *
 * Arguments are positional on purpose: npm eats --flags before a script sees
 * them, and this needs to work through npm.
 */
const [kindArg, first, second] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

const KINDS = {
  search: { kind: "search", what: "a search for a product", needs: "the term you searched for" },
  basket: { kind: "basket-read", what: "your basket contents" },
  add: { kind: "basket-add", what: "adding one item to your basket", needs: "the product id it sent" },
};

const chosen = KINDS[kindArg];
if (!chosen) {
  console.error("Usage:");
  console.error("  npm run refresh -- search chicken        the request that returns products");
  console.error("  npm run refresh -- basket                the request that returns your basket");
  console.error("  npm run refresh -- add <product-id> 1    the request that adds one item");
  process.exit(1);
}
if (kindArg === "search" && !first) {
  console.error('Give the term you searched for, e.g. npm run refresh -- search chicken');
  process.exit(1);
}

console.log(`Ready to learn the request for ${chosen.what}.`);
console.log("");
console.log("  1. In your browser: DevTools → Network → Fetch/XHR");
console.log(`  2. Do it once (so the request is fresh), then right-click it → Copy → Copy as cURL`);
console.log("  3. Come straight back here and press Enter");
console.log("");
console.log("Speed matters: the retailer's token expires within minutes of being issued.");

await waitForEnter();

let clipboard;
try {
  clipboard = readClipboard();
} catch (error) {
  console.error(`Could not read the clipboard: ${error.message}`);
  process.exit(1);
}

const verdict = classifyClipboard(clipboard);
if (verdict.kind !== "curl") {
  console.error(`\nThat is not a copied request — ${verdict.why}`);
  console.error("Nothing was changed. Copy the request in DevTools and run this again.");
  process.exit(1);
}
console.log(`\nGot a ${verdict.method} request to ${verdict.host}.`);

const outcome = await learnEndpoint({
  text: clipboard,
  kind: chosen.kind,
  term: kindArg === "search" ? first : undefined,
  productId: kindArg === "add" ? first : undefined,
  qty: kindArg === "add" ? (second ?? "1") : undefined,
});

console.log("");
if (outcome.ok) {
  console.log("Done. That endpoint is configured.");
  if (kindArg === "search") console.log("Next: npm run refresh -- basket");
  else if (kindArg === "basket") console.log("Next: add one cheap item by hand, then: npm run refresh -- add <id> 1");
  else console.log("All three captured. Start it up: npm run server   (and npm run dev in a second terminal)");
} else if (outcome.reason === "expired") {
  console.error("The token was already expired when we used it.");
  console.error("Reload the Tesco page, redo the action, and run this again straight away.");
  process.exit(1);
} else {
  console.error("The endpoint was recorded, but the response could not be read automatically.");
  console.error("Paste the lines above and they can be mapped by hand.");
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
