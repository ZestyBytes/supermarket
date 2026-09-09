#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { learnEndpoint } from "../server/learn-endpoint.mjs";

/**
 * Learn an endpoint from a request saved to a file.
 *
 * For a fresher path, `npm run refresh -- search chicken` copies from the
 * clipboard and learns immediately, which matters when the retailer's token
 * expires within minutes.
 *
 *   node scripts/learn-endpoint.mjs --kind search      --term chicken     --file search.txt
 *   node scripts/learn-endpoint.mjs --kind basket-read                    --file basket.txt
 *   node scripts/learn-endpoint.mjs --kind basket-add  --product-id 12345 --qty 1 --file add.txt
 *
 * Run it with node, not `npm run`: npm parses unknown --flags as its own
 * config and they never reach the script.
 */
const args = process.argv.slice(2);
const kind = flag("--kind");
const file = flag("--file");

if (!kind || !file) {
  fail(
    [
      "Run this with node directly, because npm eats the flags:",
      "",
      "  node scripts/learn-endpoint.mjs --kind search      --term chicken --file search.txt",
      "  node scripts/learn-endpoint.mjs --kind basket-read                --file basket.txt",
      "  node scripts/learn-endpoint.mjs --kind basket-add  --product-id 12345 --qty 1 --file add.txt",
      "",
      "Or capture and learn in one step: npm run refresh -- search chicken",
    ].join("\n"),
  );
}
if (!["search", "basket-read", "basket-add"].includes(kind)) {
  fail(`--kind must be search, basket-read or basket-add (got "${kind}")`);
}
if (!existsSync(file)) fail(`No file at ${file}`);

const outcome = await learnEndpoint({
  text: readFileSync(file, "utf8"),
  kind,
  term: flag("--term"),
  productId: flag("--product-id"),
  qty: flag("--qty"),
  configFile: process.env.RETAILER_CONFIG ?? "retailer.config.json",
  dryRun: args.includes("--dry-run"),
});

if (!outcome.ok && outcome.reason === "expired") {
  console.error("\nThe token in that file has expired. Capture and learn in one step instead:");
  console.error("  npm run refresh -- search chicken");
  process.exit(1);
}

function flag(name) {
  const index = args.indexOf(name);
  const value = args[index + 1];
  return index > -1 && value && !value.startsWith("--") ? value : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
