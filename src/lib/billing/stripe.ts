import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env.server";

export const hasStripe = Boolean(serverEnv.STRIPE_SECRET_KEY && serverEnv.STRIPE_WEBHOOK_SECRET);

let client: Stripe | null = null;

/**
 * The Stripe client, created on first use: importing this module during the
 * build must not require the secret key. The SDK pins its own API version.
 */
export function getStripe(): Stripe {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  client ??= new Stripe(serverEnv.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2, // retries reuse the same idempotency key
    appInfo: { name: "FarmCrate" },
  });
  return client;
}

export function webhookSecret(): string {
  if (!serverEnv.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return serverEnv.STRIPE_WEBHOOK_SECRET;
}
