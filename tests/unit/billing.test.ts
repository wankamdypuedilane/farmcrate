import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { buildSubscriptionCheckout } from "@/lib/billing/checkout";
import { toLocalStatus } from "@/lib/billing/status";
import { type BillingDeps, handleBillingEvent } from "@/lib/billing/webhook";

describe("subscription Checkout", () => {
  const params = buildSubscriptionCheckout({
    subscriptionId: "00000000-0000-4000-8000-0000000000s1",
    stripeCustomerId: "cus_TestAnna",
    coopSlug: "monts-darree",
    coopName: "Monts d'Arrée Farm Co-op",
    planName: "Family box",
    weeklyPriceCents: 2900,
    pickupPointName: "Sizun community hall",
    siteUrl: "https://farmcrate.example",
  });

  it("bills the plan's price every week, in euros", () => {
    expect(params.mode).toBe("subscription");
    expect(params.line_items?.[0]?.price_data).toMatchObject({
      currency: "eur",
      unit_amount: 2900,
      recurring: { interval: "week" },
    });
  });

  it("links the Stripe subscription back to our row", () => {
    expect(params.client_reference_id).toBe("00000000-0000-4000-8000-0000000000s1");
    expect(params.subscription_data?.metadata).toEqual({ subscription_id: "00000000-0000-4000-8000-0000000000s1" });
    expect(params.success_url).toBe("https://farmcrate.example/account?subscribed={CHECKOUT_SESSION_ID}");
  });
});

describe("Stripe statuses", () => {
  it("map to what the co-op needs: pack, do not pack yet, or stop", () => {
    expect(["active", "trialing"].map((s) => toLocalStatus(s as Stripe.Subscription.Status))).toEqual(["active", "active"]);
    expect(["past_due", "unpaid", "paused"].map((s) => toLocalStatus(s as Stripe.Subscription.Status))).toEqual([
      "past_due", "past_due", "past_due",
    ]);
    expect(["canceled", "incomplete_expired"].map((s) => toLocalStatus(s as Stripe.Subscription.Status))).toEqual([
      "canceled", "canceled",
    ]);
    expect(toLocalStatus("incomplete")).toBe("incomplete");
  });
});

function deps(): BillingDeps {
  const seen = new Set<string>();
  return {
    isProcessed: vi.fn(async (id: string) => seen.has(id)),
    markProcessed: vi.fn(async (id: string) => void seen.add(id)),
    activate: vi.fn(async () => "activated"),
    sync: vi.fn(async () => "updated"),
  };
}

const event = (type: string, object: object, created = 1_798_000_000, id = "evt_test_1") =>
  ({ id, type, created, object: "event", data: { object } }) as unknown as Stripe.Event;

describe("billing events", () => {
  it("activate the subscription when its Checkout completes", async () => {
    const d = deps();
    const completed = event("checkout.session.completed", {
      id: "cs_test_1", mode: "subscription", client_reference_id: "s1", subscription: "sub_test_1",
    });
    expect(await handleBillingEvent(completed, d)).toBe("activated");
    expect(d.activate).toHaveBeenCalledWith({
      subscriptionId: "s1", sessionId: "cs_test_1", stripeSubscriptionId: "sub_test_1", eventAt: new Date(1_798_000_000_000),
    });
    expect(await handleBillingEvent(completed, d)).toBe("duplicate");
  });

  it("sync status and period end, with the event's own time for ordering", async () => {
    const d = deps();
    const updated = event("customer.subscription.updated", {
      id: "sub_test_1", status: "past_due", items: { data: [{ current_period_end: 1_798_600_000 }] },
    }, 1_798_500_000);
    await handleBillingEvent(updated, d);
    expect(d.sync).toHaveBeenCalledWith({
      stripeSubscriptionId: "sub_test_1", status: "past_due",
      periodEnd: new Date(1_798_600_000_000), eventAt: new Date(1_798_500_000_000),
    });
  });

  it("treat a deleted subscription as cancelled, whatever its last status", async () => {
    const d = deps();
    await handleBillingEvent(event("customer.subscription.deleted", { id: "sub_test_1", status: "active", items: { data: [] } }), d);
    expect(d.sync).toHaveBeenCalledWith(expect.objectContaining({ status: "canceled", periodEnd: null }));
  });

  it("are not marked as processed when handling fails, so Stripe retries", async () => {
    const d = { ...deps(), activate: vi.fn(async () => Promise.reject(new Error("database down"))) };
    const completed = event("checkout.session.completed", { id: "cs", mode: "subscription", client_reference_id: "s1", subscription: "sub" });
    await expect(handleBillingEvent(completed, d)).rejects.toThrow("database down");
    expect(d.markProcessed).not.toHaveBeenCalled();
  });
});
