import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Architecture rules (chapter 21): which module may depend on which.
// A rule in the linter is checked on every save, in CI and by agents' hooks;
// a rule in a document is checked when someone remembers it.
const adminClient = {
  name: "@/lib/supabase/admin",
  message:
    "The secret-key client bypasses Row Level Security. Use it only in the server modules listed in docs/ARCHITECTURE.md.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A leading underscore marks a parameter that must exist but is not used.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Everyone except the few trusted server modules.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/supabase/admin.ts", "src/lib/billing/store.ts"],
    rules: { "no-restricted-imports": ["error", { paths: [adminClient] }] },
  },
  {
    // Domain logic does not depend on pages or components: it can be tested,
    // reused and moved without them.
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [adminClient],
          patterns: [
            { group: ["@/app/*", "@/components/*"], message: "src/lib must not import from src/app or src/components." },
          ],
        },
      ],
    },
  },
  {
    // The trusted modules may use the admin client, and still not the UI.
    files: ["src/lib/billing/store.ts", "src/lib/supabase/admin.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/app/*", "@/components/*"], message: "src/lib must not import from src/app or src/components." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
