import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so a built copy also opens from the file system or a subpath.
  base: "./",
  server: { port: 5173 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
