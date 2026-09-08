import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so a built copy also opens from the file system or a subpath.
  base: "./",
  server: {
    // Bound to loopback by default; `npm run start:host` passes --host to open
    // it to the home network so a phone can reach it.
    port: 5173,
    strictPort: true,
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
