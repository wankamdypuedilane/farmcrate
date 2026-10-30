import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PendingSkipCredit } from "./reconcile";
import type { SubscriptionStatus } from "./status";

// Billing state changes, run with the secret key through the SQL functions of
// the subscriptions migration. Each one is idempotent.

export class AlreadySubscribedError extends Error {}

export async function openSubscription(input: { customerId: string; coopId: string; planId: string; pickupPointId: string }) {
  const { data, error } = await createAdminClient().rpc("open_subscription", {
    p_customer: input.customerId,
    p_coop: input.coopId,
    p_plan: input.planId,
    p_pickup: input.pickupPointId,
  });
  if (error?.code === "23505") throw new AlreadySubscribedError();
  if (error) throw new Error(`Could not open the subscription: ${error.message}`);
  return data as string;
}

/** The Checkout session of the customer's pending subscription with this co-op, if any. */
export async function pendingCheckoutSession(customerId: string, coopId: string) {
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .select("checkout_session_id")
    .eq("customer_id", customerId)
    .eq("coop_id", coopId)
    .eq("status", "incomplete")
    .maybeSingle<{ checkout_session_id: string | null }>();
  if (error) throw new Error(`Could not read the pending checkout: ${error.message}`);
  return data?.checkout_session_id ?? null;
}

export async function attachCheckoutSession(subscriptionId: string, sessionId: string) {
  const { error } = await createAdminClient()
    .from("subscriptions")
    .update({ checkout_session_id: sessionId })
    .eq("id", subscriptionId)
    .eq("status", "incomplete");
  if (error) throw new Error(`Could not attach the session: ${error.message}`);
}

export async function activateSubscription(input: {
  subscriptionId: string;
  sessionId: string;
  stripeSubscriptionId: string;
  eventAt: Date;
}) {
  const { data, error } = await createAdminClient().rpc("activate_subscription", {
    p_subscription: input.subscriptionId,
    p_checkout_session: input.sessionId,
    p_stripe_subscription: input.stripeSubscriptionId,
    p_event_at: input.eventAt.toISOString(),
  });
  if (error) throw new Error(`Could not activate: ${error.message}`);
  return data as string;
}

export async function syncSubscription(input: {
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  periodEnd: Date | null;
  eventAt: Date;
}) {
  const { data, error } = await createAdminClient().rpc("sync_subscription", {
    p_stripe_subscription: input.stripeSubscriptionId,
    p_status: input.status,
    p_period_end: input.periodEnd?.toISOString() ?? null,
    p_event_at: input.eventAt.toISOString(),
  });
  if (error) throw new Error(`Could not sync: ${error.message}`);
  return data as string;
}

export async function recordSkipCredit(subscriptionId: string, deliveryDate: string, creditId: string) {
  const { error } = await createAdminClient().rpc("record_skip_credit", {
    p_subscription: subscriptionId,
    p_delivery: deliveryDate,
    p_credit: creditId,
  });
  if (error) throw new Error(`Could not record the credit: ${error.message}`);
}

type PendingRow = {
  subscription_id: string;
  delivery_date: string;
  credit_cents: number;
  stripe_customer_id: string;
  created_at: string;
};

export async function pendingSkipCredits(limit: number): Promise<PendingSkipCredit[]> {
  const { data, error } = await createAdminClient().rpc("pending_skip_credits", { p_limit: limit });
  if (error) throw new Error(`Could not read pending credits: ${error.message}`);
  return ((data ?? []) as PendingRow[]).map((row) => ({
    subscriptionId: row.subscription_id,
    deliveryDate: row.delivery_date,
    creditCents: row.credit_cents,
    stripeCustomerId: row.stripe_customer_id,
    createdAt: new Date(row.created_at),
  }));
}

export async function isEventProcessed(eventId: string) {
  const { data, error } = await createAdminClient().from("stripe_events").select("id").eq("id", eventId).maybeSingle();
  if (error) throw new Error(`Could not read processed events: ${error.message}`);
  return data !== null;
}

export async function markEventProcessed(eventId: string, type: string) {
  const { error } = await createAdminClient()
    .from("stripe_events")
    .upsert({ id: eventId, type }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`Could not record the event: ${error.message}`);
}

export async function getStripeCustomerId(userId: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single<{ stripe_customer_id: string | null }>();
  return data?.stripe_customer_id ?? null;
}

export async function saveStripeCustomerId(userId: string, customerId: string) {
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId)
    .is("stripe_customer_id", null);
  if (error) throw new Error(`Could not save the customer: ${error.message}`);
}
