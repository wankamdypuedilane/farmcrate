// @vitest-environment node
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fictional secrets: the real ones come from `stripe listen` or the Dashboard.
const SECRET = "whsec_test_YOUR_WEBHOOK_SECRET";
const stripe = new Stripe("sk_test_YOUR_SECRET_KEY");

const deps = vi.hoisted(() => ({
  isProcessed: vi.fn(async () => false),
  markProcessed: vi.fn(async () => {}),
  activate: vi.fn(async () => "activated"),
  sync: vi.fn(async () => "updated"),
}));

// The real signature check runs; only the database side is replaced.
vi.mock("@/lib/billing/stripe", () => ({ getStripe: () => stripe, webhookSecret: () => SECRET }));
vi.mock("@/lib/billing/operations", () => ({ billingDeps: deps }));

const { POST } = await import("@/app/api/stripe/webhook/route");

const body = JSON.stringify({
  id: "evt_test_1",
  object: "event",
  type: "checkout.session.completed",
  created: 1_798_000_000,
  data: { object: { id: "cs_test_1", mode: "subscription", client_reference_id: "s1", subscription: "sub_test_1" } },
});

function signed(payload: string, options: { secret?: string; timestamp?: number } = {}) {
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: options.secret ?? SECRET, timestamp: options.timestamp });
  return new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: payload });
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a signed event and activates the subscription", async () => {
    const response = await POST(signed(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: "activated" });
  });

  it("rejects missing or foreign signatures, altered bodies and old events", async () => {
    expect((await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body }))).status).toBe(400);
    expect((await POST(signed(body, { secret: "whsec_test_SOMEONE_ELSE" }))).status).toBe(400);
    const original = signed(body);
    const altered = new Request(original.url, { method: "POST", headers: original.headers, body: JSON.stringify(JSON.parse(body), null, 2) });
    expect((await POST(altered)).status).toBe(400);
    expect((await POST(signed(body, { timestamp: Math.floor(Date.now() / 1000) - 600 }))).status).toBe(400);
    expect(deps.activate).not.toHaveBeenCalled();
  });

  it("answers 500 when processing fails, so that Stripe retries", async () => {
    deps.activate.mockRejectedValueOnce(new Error("database down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(signed(body))).status).toBe(500);
  });
});
