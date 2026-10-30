import type Stripe from "stripe";
import { toLocalStatus, type SubscriptionStatus } from "./status";

export type BillingDeps = {
  isProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string, type: string): Promise<void>;
  activate(input: { subscriptionId: string; sessionId: string; stripeSubscriptionId: string; eventAt: Date }): Promise<string>;
  sync(input: { stripeSubscriptionId: string; status: SubscriptionStatus; periodEnd: Date | null; eventAt: Date }): Promise<string>;
  /** Cancels a Stripe subscription that no row of ours will ever pack for. */
  cancelOrphan(stripeSubscriptionId: string, sessionId: string): Promise<void>;
};

const idOf = (value: string | { id: string } | null) => (value === null ? null : typeof value === "string" ? value : value.id);

/** Handles one verified event. Each branch is idempotent and safe to receive out of order. */
export async function handleBillingEvent(event: Stripe.Event, deps: BillingDeps): Promise<string> {
  if (await deps.isProcessed(event.id)) return "duplicate";
  // Stripe's own timestamp for the event: newer states win, whatever the arrival order.
  const eventAt = new Date(event.created * 1000);
  let result = "ignored";

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const stripeSubscriptionId = idOf(session.subscription);
      if (session.mode === "subscription" && session.client_reference_id && stripeSubscriptionId) {
        result = await deps.activate({
          subscriptionId: session.client_reference_id,
          sessionId: session.id,
          stripeSubscriptionId,
          eventAt,
        });
        // A session that our row no longer points to (a second tab, an older checkout):
        // nobody would pack its boxes, so its subscription must not keep billing.
        if (result === "mismatch") {
          await deps.cancelOrphan(stripeSubscriptionId, session.id);
          result = "orphan_canceled";
        }
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      // In the API version pinned by our SDK, billing periods belong to the subscription items.
      const periodEnd = subscription.items.data[0]?.current_period_end;
      result = await deps.sync({
        stripeSubscriptionId: subscription.id,
        status: event.type === "customer.subscription.deleted" ? "canceled" : toLocalStatus(subscription.status),
        periodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        eventAt,
      });
      break;
    }
  }
  await deps.markProcessed(event.id, event.type);
  return result;
}
