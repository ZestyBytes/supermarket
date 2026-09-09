#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mutationsIn, narrowToOperation, operationsIn } from "../server/learn.mjs";

/**
 * Narrow a stored endpoint to one operation, without capturing anything again.
 *
 * A retailer batches several operations into one request, so a capture taken
 * before that was handled holds all of them. The operation you want is already
 * in the config, so this keeps it and drops the rest, which matters most when
 * one of the others is a mutation that would change the basket on every read.
 *
 *   node scripts/narrow-config.mjs basket GetBasket
 *   node scripts/narrow-config.mjs search Search
 *   node scripts/narrow-config.mjs add UpdateBasket
 *
 * With no operation name it lists what the stored request contains.
 */
const CONFIG = process.env.RETAILER_CONFIG ?? "retailer.config.json";
const [section, operation] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

const SECTIONS = {
  search: { read: (c) => c.search, write: (c, v) => (c.search = v), isRead: true },
  basket: { read: (c) => c.basket?.read, write: (c, v) => ((c.basket ??= {}).read = v), isRead: true },
  add: { read: (c) => c.basket?.add, write: (c, v) => ((c.basket ??= {}).add = v), isRead: false },
};

const target = SECTIONS[section];
if (!target) {
  console.error("Usage: node scripts/narrow-config.mjs <search|basket|add> [OperationName]");
  process.exit(1);
}
if (!existsSync(CONFIG)) {
  console.error(`No ${CONFIG} yet. Learn an endpoint first: npm run refresh -- basket`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG, "utf8"));
const entry = target.read(config);

if (!entry?.body) {
  console.error(`${section} has no stored request body to narrow.`);
  process.exit(1);
}

const present = [...new Set(operationsIn(entry.body))];
const mutations = mutationsIn(entry.body);

if (!operation) {
  console.log(`${section} currently holds: ${present.join(", ") || "(no named operations)"}`);
  if (mutations.length > 0) {
    console.log(`  Mutations in there: ${mutations.join(", ")}. These change your basket.`);
  }
  console.log(`\nKeep one with: node scripts/narrow-config.mjs ${section} <OperationName>`);
  process.exit(0);
}

if (!present.includes(operation)) {
  console.error(`"${operation}" is not in the stored ${section} request.`);
  console.error(`  It holds: ${present.join(", ") || "(no named operations)"}`);
  process.exit(1);
}

const narrowed = narrowToOperation(entry.body, operation);
const left = mutationsIn(narrowed);

if (target.isRead && left.length > 0) {
  console.error(`Refusing: "${operation}" is itself a mutation (${left.join(", ")}), and a read must not change anything.`);
  process.exit(1);
}

target.write(config, { ...entry, body: narrowed });
writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`);

const dropped = present.filter((name) => name !== operation);
console.log(`Kept "${operation}" in ${section}.`);
if (dropped.length > 0) console.log(`  Dropped: ${dropped.join(", ")}`);
if (mutations.length > 0) console.log(`  Including the mutation ${mutations.join(", ")}, which would have run on every read.`);
console.log(`\nWrote ${CONFIG}`);
