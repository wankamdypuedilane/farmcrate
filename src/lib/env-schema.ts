import { z } from "zod";

// Server-only configuration. Values are optional at this stage so that the
// app builds without secrets; each feature checks for the keys it needs.
export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z
    .string()
    .startsWith("sb_secret_", "must be a Supabase secret key (sb_secret_...)")
    .optional(),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  // Stripe (chapter 18). This book runs Stripe in test mode only: a live key
  // (sk_live_...) is refused, so a copied production key cannot be used by mistake.
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^(sk|rk)_test_[A-Za-z0-9]+$/, "must be a Stripe test-mode key (sk_test_... or rk_test_...)")
    .optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_", "must be a webhook signing secret (whsec_...)").optional(),
  // Sent by Vercel Cron as "Authorization: Bearer <CRON_SECRET>" (api/cron/reconcile).
  CRON_SECRET: z.string().min(16, "must be at least 16 random characters").optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Name the variable, never print its value: it may be a secret.
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${problems}`);
  }
  return result.data;
}
