"use server";

import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth/current-user";
import { buildSubscriptionCheckout } from "@/lib/billing/checkout";
import { closePreviousCheckout, ensureStripeCustomer } from "@/lib/billing/operations";
import { subscribeSchema } from "@/lib/billing/schemas";
import { AlreadySubscribedError, attachCheckoutSession, openSubscription } from "@/lib/billing/store";
import { getStripe, hasStripe } from "@/lib/billing/stripe";
import { log } from "@/lib/log";
import { getCatalog } from "@/lib/shop/queries";
import { siteUrl } from "@/lib/site";

export type SubscribeState = { status: "idle" | "error"; message?: string };

export async function subscribe(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const parsed = subscribeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Choose a box and a pickup point." };
  const { coopSlug, planId, pickupPointId } = parsed.data;
  const user = await requireUser(`/${coopSlug}`);
  if (!hasStripe) return { status: "error", message: "Online subscription is not available yet." };

  // Names and price come from the co-op's catalogue, read on the server.
  const catalog = await getCatalog(coopSlug);
  const plan = catalog?.plans.find((p) => p.id === planId);
  const pickup = catalog?.pickupPoints.find((p) => p.id === pickupPointId);
  if (!catalog || !plan || !pickup) return { status: "error", message: "This box is no longer available." };

  // An earlier, abandoned payment page must not stay payable once a new one exists.
  if (!(await closePreviousCheckout(user.id, catalog.coop.id))) {
    return { status: "error", message: "Your payment is being confirmed: see My boxes in a moment." };
  }

  let subscriptionId: string;
  try {
    subscriptionId = await openSubscription({ customerId: user.id, coopId: catalog.coop.id, planId, pickupPointId });
  } catch (error) {
    if (error instanceof AlreadySubscribedError) {
      return { status: "error", message: "You already have a subscription with this co-op: see My boxes." };
    }
    throw error;
  }

  let url: string | null = null;
  try {
    const profile = await getProfile();
    const stripeCustomerId = await ensureStripeCustomer(user, profile?.full_name ?? "");
    const session = await getStripe().checkout.sessions.create(
      buildSubscriptionCheckout({
        subscriptionId,
        stripeCustomerId,
        coopSlug,
        coopName: catalog.coop.name,
        planName: plan.name,
        weeklyPriceCents: plan.weekly_price_cents,
        pickupPointName: pickup.name,
        siteUrl,
      }),
      // An abandoned checkout is reused with new choices: the key includes them,
      // because Stripe refuses a key reused with different parameters.
      { idempotencyKey: `checkout-${subscriptionId}-${planId}-${pickupPointId}` },
    );
    await attachCheckoutSession(subscriptionId, session.id);
    url = session.url;
  } catch (error) {
    log("error", "Checkout could not start", { subscriptionId, reason: String(error) });
  }
  if (!url) return { status: "error", message: "Payment is unavailable right now. Please try again." };
  redirect(url);
}
