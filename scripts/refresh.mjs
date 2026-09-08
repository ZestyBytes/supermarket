#!/usr/bin/env node
import { createInterface } from "node:readline";
import { readClipboard } from "../server/clipboard.mjs";
import { classifyClipboard, pickRequest, splitCurls } from "../server/learn.mjs";
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
const [kindArg, first, second, third] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

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
console.log("  2. Do it once, so the request is fresh");
console.log("  3. Right-click anywhere in the request list → Copy → Copy ALL as cURL");
console.log("  4. Come straight back here and press Enter");
console.log("");
console.log("Copy all of them — picking the right row is this tool's job, not yours.");
console.log("");
console.log("The token in a captured request lasts about an hour, so do the action now rather than");
console.log("reusing something copied earlier.");

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
  console.error("Nothing was changed. Copy the requests in DevTools and run this again.");
  process.exit(1);
}

const commands = splitCurls(clipboard);
console.log(`\nGot ${commands.length} request${commands.length === 1 ? "" : "s"} from the clipboard.`);

const picked = pickRequest(commands, chosen.kind, third, { term: kindArg === "search" ? first : undefined });
if (!picked.ok) {
  reportPickFailure(picked);
  process.exit(1);
}
if (picked.operation) console.log(`Picked the "${picked.operation}" request.`);

const outcome = await learnEndpoint({
  text: picked.command,
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
  console.error("Reload the page, redo the action, and run this again.");
  process.exit(1);
} else if (outcome.reason === "wrong-operation") {
  process.exit(1);
} else {
  console.error("The endpoint was recorded, but the response could not be read automatically.");
  console.error("Paste the lines above and they can be mapped by hand.");
  process.exit(1);
}

function reportPickFailure(picked) {
  if (picked.reason === "none-parsed") {
    console.error("\nNone of that could be read as a request. Use Copy → Copy all as cURL.");
    return;
  }
  if (picked.reason === "ambiguous") {
    console.error(`\nSeveral requests could be the one: ${picked.seen.join(", ")}`);
    console.error("Run it again naming the one you want, e.g.");
    console.error(`  npm run refresh -- ${kindArg} ${first ?? ""} ${picked.seen[0]}`.replace(/\s+/g, " "));
    return;
  }
  if (picked.reason === "no-such-operation") {
    console.error(`\nNo request named that. The clipboard held: ${picked.seen.join(", ")}`);
    return;
  }
  console.error(`\nNothing in the clipboard looks like ${chosen.what}.`);
  if (kindArg === "search") {
    console.error(`  No copied request contained "${first}" — so the search you typed is not among them.`);
    console.error("  Clear the Network list, search again with it open, then copy all as cURL.");
  }
  console.error(`  The requests copied were: ${picked.seen.slice(0, 20).join(", ") || "(none named)"}`);
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
