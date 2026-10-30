import type Stripe from "stripe";

export const CURRENCY = "eur";

export type SubscriptionCheckoutInput = {
  subscriptionId: string;
  stripeCustomerId: string;
  coopSlug: string;
  coopName: string;
  planName: string;
  weeklyPriceCents: number;
  pickupPointName: string;
  siteUrl: string;
};

/**
 * Checkout for a weekly box subscription. The price comes from the plan read on
 * the server; Stripe then bills it every week until the customer cancels.
 */
export function buildSubscriptionCheckout(input: SubscriptionCheckoutInput): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: input.stripeCustomerId,
    client_reference_id: input.subscriptionId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: input.weeklyPriceCents,
          recurring: { interval: "week" },
          product_data: { name: `${input.coopName}: ${input.planName}` },
        },
      },
    ],
    // Copied onto the Stripe subscription: its events can be traced back to our row.
    subscription_data: { metadata: { subscription_id: input.subscriptionId } },
    custom_text: {
      submit: { message: `Pickup: ${input.pickupPointName}. Skip any week up to the cut-off; skipped boxes are credited.` },
    },
    success_url: `${input.siteUrl}/account?subscribed={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.siteUrl}/${input.coopSlug}`,
  };
}
