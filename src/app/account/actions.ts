"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { billingPortalUrl, creditSkip } from "@/lib/billing/operations";
import { skipSchema } from "@/lib/billing/schemas";
import { getStripeCustomerId } from "@/lib/billing/store";
import { hasStripe } from "@/lib/billing/stripe";
import { log } from "@/lib/log";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type SkipState = { status: "idle" | "done" | "error"; message?: string };

export async function skipDelivery(_prev: SkipState, formData: FormData): Promise<SkipState> {
  const user = await requireUser("/account");
  const parsed = skipSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Invalid request." };
  const { subscriptionId, deliveryDate } = parsed.data;

  // The insert policy decides: own active subscription, real delivery day, before the cut-off.
  const supabase = await createClient();
  const { data: skip, error } = await supabase
    .from("skips")
    .insert({ subscription_id: subscriptionId, delivery_date: deliveryDate })
    .select("credit_cents")
    .single<{ credit_cents: number }>();
  if (error?.code === "23505") return { status: "done", message: "Already skipped." };
  if (error) return { status: "error", message: "This delivery can no longer be skipped." };

  // The skip is recorded; the credit follows. If Stripe is unreachable, the skip
  // stays (stripe_credit_id is null) and the daily job retries (api/cron/reconcile).
  const stripeCustomerId = await getStripeCustomerId(user.id);
  if (hasStripe && stripeCustomerId) {
    try {
      await creditSkip({ stripeCustomerId, subscriptionId, deliveryDate, creditCents: skip.credit_cents });
    } catch (reason) {
      log("error", "Skip credit failed", { subscriptionId, deliveryDate, reason: String(reason) });
    }
  }
  refresh();
  return { status: "done", message: "Skipped. The box price will be deducted from your next payment." };
}

export async function manageBilling(): Promise<void> {
  const user = await requireUser("/account");
  const stripeCustomerId = await getStripeCustomerId(user.id);
  if (!hasStripe || !stripeCustomerId) redirect("/account");
  redirect(await billingPortalUrl(stripeCustomerId, `${siteUrl}/account`));
}
