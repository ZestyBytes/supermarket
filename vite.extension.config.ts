import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function version(): string {
  try {
    return execSync("git log -1 --pretty=%h", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Take the webfont link out of the extension's copy.
 *
 * An extension page may not pull a stylesheet from another origin, so the link
 * either fails silently or is refused outright. The stack already names real
 * fallbacks, so removing it is the difference between a font that loads and a
 * console full of refusals.
 */
function withoutRemoteFonts() {
  return {
    name: "without-remote-fonts",
    closeBundle() {
      const page = "browser-extension/app/index.html";
      const html = readFileSync(page, "utf8")
        .replace(/\s*<link rel="preconnect"[^>]*>/g, "")
        .replace(/\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/g, "");
      writeFileSync(page, html);
    },
  };
}

/**
 * The same app, built to run inside the extension.
 *
 * Nothing about the app changes: it is the identical source, and the only
 * difference at runtime is that it may call Tesco itself instead of asking a
 * local server to. Kept as a second config rather than a flag so the hosted
 * build cannot accidentally acquire extension assumptions.
 */
export default defineConfig({
  plugins: [react(), withoutRemoteFonts()],
  base: "./",
  define: { __BUILD__: JSON.stringify(version()) },
  build: {
    outDir: "browser-extension/app",
    emptyOutDir: true,
    // One file each, because an extension page loads from disk and there is
    // nothing to be gained from splitting it.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
