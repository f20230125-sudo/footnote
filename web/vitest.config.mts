import { defineConfig } from "vitest/config";

export default defineConfig({
  // Read the "@/..." import alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
  },
});
