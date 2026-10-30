# FarmCrate architecture

## Overview

```
Browser ──> Vercel (Next.js 16: pages, Server Actions, Route Handlers)
              │  user's session (cookies)          │ secret key, server only
              ▼                                    ▼
          Supabase: Auth, PostgreSQL with RLS, SQL functions
              ▲
Stripe ───────┘ webhooks (/api/stripe/webhook), Checkout, customer portal
Vercel Cron ──> /api/cron/reconcile (daily)
```

## Modules and dependency rules

```
src/app/              routes: pages, layouts, Server Actions, Route Handlers (thin)
src/components/       UI components; data only through props and actions
src/lib/deliveries/   pure rules: delivery days, cut-offs, rows of "My boxes"
src/lib/billing/      Stripe: Checkout parameters, webhook handling, reconciliation
                      (pure, injected dependencies), store.ts (secret key), operations.ts
src/lib/shop/         catalogue queries (public data, cached)
src/lib/account/      the customer's own data (never cached)
src/lib/security/     headers (CSP), client IP, cron authorization
supabase/migrations/  the schema: tables, RLS policies, SQL functions
```

- `src/app` may import `src/lib` and `src/components`; `src/lib` imports neither.
- Pure modules take "now" and data as parameters: `schedule.ts`, `rows.ts`,
  `checkout.ts`, `webhook.ts`, `reconcile.ts`. They have unit tests.
- Customer and staff data is read with the user's Supabase client: RLS decides.
- The secret-key client (`src/lib/supabase/admin.ts`) is used only by
  `src/lib/billing/store.ts`, which calls the service-role SQL functions.
- Enforced by `eslint.config.mjs`, tested in `tests/unit/architecture.test.ts`.

## Data model

| Table | Owner | Written by |
|---|---|---|
| `profiles` | the user | trigger on sign-up; `full_name` by the user; `stripe_customer_id` by server code |
| `coops`, `coop_members` | operators | service role only |
| `pickup_points`, `box_plans`, `box_contents` | a co-op | its staff (RLS); read by anyone if the co-op is public |
| `subscriptions` | a customer, in a co-op | SQL functions called by server code (`open_subscription`, `activate_subscription`, `sync_subscription`) |
| `skips` | a customer | the customer (insert of two columns, checked by `private.can_skip`); the credit by trigger and `record_skip_credit` |
| `stripe_events` | the system | the webhook (service role) |

## Request flows

1. **Subscribe**: Server Action `subscribe` → zod → `open_subscription` (reuses an
   abandoned one) → Stripe customer (once) → Checkout session (idempotency key)
   → `attachCheckoutSession` → redirect to Stripe.
2. **Activation**: Stripe → `/api/stripe/webhook` (raw body, signature) →
   `handleBillingEvent` → `activate_subscription` (checks the session id).
3. **Renewal, failure, cancellation**: `customer.subscription.updated/deleted` →
   `sync_subscription` (older events ignored, D6).
4. **Skip**: Server Action `skipDelivery` → insert with the user's client (RLS
   decides) → Stripe balance credit → `record_skip_credit`. If Stripe fails: the
   daily reconciliation (D8).
5. **Packing**: page `/[coop]/packing` → `packing_list()` (security definer,
   staff guard).

## Caching

| Data | Where | Freshness | Invalidation |
|---|---|---|---|
| Co-op catalogue (plans, pickup points, contents) | `"use cache"` in `src/lib/shop/queries.ts` | `cacheLife("minutes")` | tag `coop:<slug>` (`updateTag` when staff screens arrive) |
| Home page | static | per deployment | redeploy |
| "My boxes", packing list | never cached | request time | n/a |

## Performance (measured)

PostgreSQL 16, 51 co-ops, 60,000 subscriptions, 389,538 skips (one year),
`EXPLAIN ANALYZE`:

| Query | Time | Plan |
|---|---|---|
| Packing list of one co-op (1,058 subscriptions) | 10-35 ms | bitmap scan on `subscriptions_coop_status_idx` or parallel sequential scan, then one probe of the `skips` primary key per subscription |
| "My boxes" of one customer | 1 ms | `subscriptions_customer_idx`, then `skips` primary key |
| Skips waiting for their credit | 0.03 ms | partial index `skips_pending_credit_idx` |

A covering index for the packing list was tried and dropped: the planner did not
use it at this size. Revisit beyond about 500,000 subscriptions.

## Deployment

- Vercel project `farmcrate`: Production (`main`), Preview (every pull request,
  staging Supabase project and Stripe test mode).
- Supabase: two projects, staging and production; migrations applied with
  `supabase db push` from CI after review.
- Stripe: test mode in the book; the live switch is a launch-checklist item.
- Cron: `vercel.json`, daily at 05:00 UTC (the Hobby plan allows daily jobs).

## Observability

Logs: `src/lib/log.ts` (JSON, secrets and e-mails redacted). Uptime:
`/api/health`. Errors: `src/app/error.tsx` and `global-error.tsx` with digests.
The reconciliation job logs a warning when a credit could not be created.
