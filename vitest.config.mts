import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  // Importing a CSS module from a component sends the file through Vite's CSS
  // pipeline, which chokes on the Tailwind v4 PostCSS config. Tests don't need
  // real styles, so give Vite an empty PostCSS config instead of the project's.
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
