import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/** The commit this copy was built from, so a device can say what it is showing. */
function version(): string {
  try {
    return execSync("git log -1 --pretty=%h", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],
  // Relative base so a built copy also opens from the file system or a subpath.
  base: "./",
  define: { __BUILD__: JSON.stringify(version()) },
  server: {
    // Bound to loopback by default; `npm run start:host` passes --host to open
    // it to the home network so a phone can reach it.
    port: 5173,
    strictPort: true,
    // Always ask before reusing. The same server reached as office.local and
    // as 192.168.1.230 is two origins to a browser, with two caches, so one of
    // them can sit on a build from days ago while the other is current. On a
    // home network revalidating costs a few milliseconds; being shown an old
    // app and told nothing costs an afternoon.
    headers: { "Cache-Control": "no-cache" },
    // The page never holds the retailer session; it asks the local server,
    // which is the only process that reads the cookie file.
    //
    // The API refuses anything that is not loopback, and from a phone the page
    // origin is the computer's network address — so the proxy, which runs on
    // the same machine as the API and is the only way in (the API binds to
    // 127.0.0.1), presents itself as what it is: a local caller.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        headers: { origin: "http://127.0.0.1:5173" },
      },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.mjs"] },
});
