export type PendingSkipCredit = {
  subscriptionId: string;
  deliveryDate: string;
  creditCents: number;
  stripeCustomerId: string;
  createdAt: Date;
};

export type ReconcileDeps = {
  pending(): Promise<PendingSkipCredit[]>;
  /** The id of a credit already created at Stripe for this skip, or null. */
  findCredit(skip: PendingSkipCredit): Promise<string | null>;
  createCredit(skip: PendingSkipCredit): Promise<string>;
  record(skip: PendingSkipCredit, creditId: string): Promise<void>;
  onError(skip: PendingSkipCredit, reason: unknown): void;
};

export type ReconcileReport = { pending: number; credited: number; recovered: number; failed: number };

/**
 * Finishes the skips whose credit is missing. A credit may exist at Stripe even
 * though our row does not say so (the answer was lost on the way back): we look
 * for it first, so a retry never credits the same box twice. One failure does
 * not stop the others; the next run tries again.
 */
export async function reconcileSkipCredits(deps: ReconcileDeps): Promise<ReconcileReport> {
  const pending = await deps.pending();
  const report: ReconcileReport = { pending: pending.length, credited: 0, recovered: 0, failed: 0 };
  for (const skip of pending) {
    try {
      const existing = await deps.findCredit(skip);
      if (existing) {
        await deps.record(skip, existing);
        report.recovered += 1;
      } else {
        await deps.record(skip, await deps.createCredit(skip));
        report.credited += 1;
      }
    } catch (reason) {
      deps.onError(skip, reason);
      report.failed += 1;
    }
  }
  return report;
}
