import { billingDeps } from "@/lib/billing/operations";
import { getStripe, webhookSecret } from "@/lib/billing/stripe";
import { handleBillingEvent } from "@/lib/billing/webhook";
import { log } from "@/lib/log";

// Stripe calls this endpoint for checkout.session.completed and
// customer.subscription.updated/deleted. Only the signature proves the sender.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });
  const body = await request.text(); // the exact bytes that were signed

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret());
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await handleBillingEvent(event, billingDeps);
    return Response.json({ received: true, result });
  } catch (error) {
    log("error", "Stripe event failed", { eventId: event.id, type: event.type, reason: String(error) });
    return Response.json({ error: "Processing failed" }, { status: 500 }); // Stripe retries
  }
}
