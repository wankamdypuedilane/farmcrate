import type Stripe from "stripe";

export type SubscriptionStatus = "incomplete" | "active" | "past_due" | "canceled";

/**
 * Stripe has more subscription statuses than FarmCrate needs. What matters to
 * the co-op is whether to pack a box: only "active" subscriptions are packed.
 */
export function toLocalStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "incomplete";
  }
}
