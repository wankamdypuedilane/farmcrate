import { describe, expect, it, vi } from "vitest";
import { type PendingSkipCredit, type ReconcileDeps, reconcileSkipCredits } from "@/lib/billing/reconcile";
import { isCronAuthorized } from "@/lib/security/cron";

const skip = (deliveryDate: string): PendingSkipCredit => ({
  subscriptionId: "00000000-0000-4000-8000-0000000000c1",
  deliveryDate,
  creditCents: 1800,
  stripeCustomerId: "cus_TestAnna",
  createdAt: new Date("2026-12-01T10:00:00Z"),
});

function fakeDeps(pending: PendingSkipCredit[], alreadyAtStripe: Record<string, string> = {}) {
  return {
    pending: vi.fn(async () => pending),
    findCredit: vi.fn(async (s: PendingSkipCredit) => alreadyAtStripe[s.deliveryDate] ?? null),
    createCredit: vi.fn(async (s: PendingSkipCredit) => `cbtxn_new_${s.deliveryDate}`),
    record: vi.fn(async () => {}),
    onError: vi.fn(),
  } satisfies ReconcileDeps;
}

describe("skip credit reconciliation", () => {
  it("creates the missing credits and records them", async () => {
    const deps = fakeDeps([skip("2026-12-11")]);
    expect(await reconcileSkipCredits(deps)).toEqual({ pending: 1, credited: 1, recovered: 0, failed: 0 });
    expect(deps.record).toHaveBeenCalledWith(skip("2026-12-11"), "cbtxn_new_2026-12-11");
  });

  it("never credits twice: a credit already at Stripe is only recorded", async () => {
    const deps = fakeDeps([skip("2026-12-11")], { "2026-12-11": "cbtxn_lost_answer" });
    expect(await reconcileSkipCredits(deps)).toEqual({ pending: 1, credited: 0, recovered: 1, failed: 0 });
    expect(deps.createCredit).not.toHaveBeenCalled();
    expect(deps.record).toHaveBeenCalledWith(skip("2026-12-11"), "cbtxn_lost_answer");
  });

  it("goes on after a failure and reports it", async () => {
    const deps = fakeDeps([skip("2026-12-11"), skip("2026-12-18")]);
    deps.createCredit.mockRejectedValueOnce(new Error("Stripe is unreachable"));
    expect(await reconcileSkipCredits(deps)).toEqual({ pending: 2, credited: 1, recovered: 0, failed: 1 });
    expect(deps.onError).toHaveBeenCalledOnce();
    expect(deps.record).toHaveBeenCalledWith(skip("2026-12-18"), "cbtxn_new_2026-12-18");
  });
});

describe("cron authorization", () => {
  const secret = "a-long-random-test-secret";

  it("accepts exactly the bearer secret", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isCronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false);
    expect(isCronAuthorized(null, secret)).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
  });
});
