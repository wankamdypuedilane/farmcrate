import { defineConfig } from "vitest/config";

// Database tests: run SQL migrations and Row Level Security policies against a
// real PostgreSQL server. See tests/db/README.md.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["./tests/db/global-setup.ts"],
    fileParallelism: false,
  },
});
