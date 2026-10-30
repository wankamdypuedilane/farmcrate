// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Architecture tests: the dependency rules of eslint.config.mjs, checked on
// small samples so that a careless change to the configuration fails here.
const eslint = new ESLint({ cwd: process.cwd() });

async function importErrors(filePath: string, source: string) {
  const [result] = await eslint.lintText(`${source}\nexport {};\n`, { filePath });
  return result!.messages.filter((m) => m.ruleId === "no-restricted-imports").map((m) => m.message);
}

describe("module boundaries", () => {
  it("keep the secret-key client out of components and pages", async () => {
    const component = await importErrors("src/components/demo.tsx", 'import { createAdminClient } from "@/lib/supabase/admin";');
    expect(component[0]).toMatch(/bypasses Row Level Security/);
    const page = await importErrors("src/app/account/demo.tsx", 'import { createAdminClient } from "@/lib/supabase/admin";');
    expect(page).toHaveLength(1);
  });

  it("let the listed server modules use it", async () => {
    expect(await importErrors("src/lib/billing/store.ts", 'import { createAdminClient } from "@/lib/supabase/admin";')).toEqual([]);
    // The webhook route goes through the billing module, not the client itself.
    expect(await importErrors("src/app/api/stripe/webhook/route.ts", 'import { createAdminClient } from "@/lib/supabase/admin";')).toHaveLength(1);
  });

  it("keep domain logic independent of pages and components", async () => {
    const errors = await importErrors("src/lib/deliveries/demo.ts", 'import { Button } from "@/components/ui/button";');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("src/lib must not import from src/app or src/components.");
  });
}, 60_000);
