import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so a built copy also opens from the file system or a subpath.
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    // The page never holds the retailer session; it asks the local server,
    // which is the only process that reads the cookie file.
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } },
  },
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.mjs"] },
});
