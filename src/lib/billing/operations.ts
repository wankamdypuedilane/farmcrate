import "server-only";
import { log } from "@/lib/log";
import { CURRENCY } from "./checkout";
import type { PendingSkipCredit, ReconcileDeps } from "./reconcile";
import * as store from "./store";
import { getStripe } from "./stripe";
import type { BillingDeps } from "./webhook";

export const billingDeps: BillingDeps = {
  isProcessed: store.isEventProcessed,
  markProcessed: store.markEventProcessed,
  activate: store.activateSubscription,
  sync: store.syncSubscription,
};

/** The customer's Stripe customer, created once and saved on the profile. */
export async function ensureStripeCustomer(user: { id: string; email: string | null }, name: string) {
  const saved = await store.getStripeCustomerId(user.id);
  if (saved) return saved;
  const customer = await getStripe().customers.create(
    { email: user.email ?? undefined, name, metadata: { profile_id: user.id } },
    { idempotencyKey: `customer-${user.id}` },
  );
  await store.saveStripeCustomerId(user.id, customer.id);
  return (await store.getStripeCustomerId(user.id)) ?? customer.id;
}

type SkipCreditInput = { stripeCustomerId: string; subscriptionId: string; deliveryDate: string; creditCents: number };

/**
 * Credits a skipped box to the customer's Stripe balance: a negative balance
 * transaction, which Stripe deducts from the next invoice. Once per skip.
 */
async function createSkipCredit(input: SkipCreditInput) {
  const credit = await getStripe().customers.createBalanceTransaction(
    input.stripeCustomerId,
    {
      amount: -input.creditCents,
      currency: CURRENCY,
      description: `Skipped box of ${input.deliveryDate}`,
      metadata: { subscription_id: input.subscriptionId, delivery_date: input.deliveryDate },
    },
    { idempotencyKey: `skip-${input.subscriptionId}-${input.deliveryDate}` },
  );
  return credit.id;
}

export async function creditSkip(input: SkipCreditInput) {
  await store.recordSkipCredit(input.subscriptionId, input.deliveryDate, await createSkipCredit(input));
}

/** A credit already created for this skip, found by its metadata (newest first, since the skip). */
async function findSkipCredit(skip: PendingSkipCredit) {
  const since = Math.floor(skip.createdAt.getTime() / 1000) - 60;
  const transactions = getStripe().customers.listBalanceTransactions(skip.stripeCustomerId, {
    created: { gte: since },
    limit: 100,
  });
  for await (const transaction of transactions) {
    const { subscription_id, delivery_date } = transaction.metadata ?? {};
    if (subscription_id === skip.subscriptionId && delivery_date === skip.deliveryDate) return transaction.id;
  }
  return null;
}

export const reconcileDeps: ReconcileDeps = {
  pending: () => store.pendingSkipCredits(50),
  findCredit: findSkipCredit,
  createCredit: createSkipCredit,
  record: (skip, creditId) => store.recordSkipCredit(skip.subscriptionId, skip.deliveryDate, creditId),
  onError: (skip, reason) =>
    log("error", "Skip credit retry failed", {
      subscriptionId: skip.subscriptionId,
      deliveryDate: skip.deliveryDate,
      reason: String(reason),
    }),
};

/** A Stripe-hosted page where customers change their card or cancel. */
export async function billingPortalUrl(stripeCustomerId: string, returnUrl: string) {
  const session = await getStripe().billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl });
  return session.url;
}
