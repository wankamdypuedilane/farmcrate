# FarmCrate: architecture decisions

Short records: the context, the decision, what we accept in exchange.
Newest at the bottom.

## D1. One installation, many co-ops (multi-tenant by `coop_id`)
- Context: every co-op needs the same features; operators are two people.
- Decision: one database; every co-op-owned table has `coop_id`; RLS policies
  call `private.is_coop_staff(coop_id)` and `private.is_public_coop(coop_id)`.
- Accepted: every new table must carry `coop_id` and its policies; the database
  tests check the separation between two co-ops.

## D2. Co-ops and their teams are created by operators
- Context: few co-ops in the first year; wrong set-up (time zone, weekday) would
  break cut-offs.
- Decision: no insert/update grants on `coops` and `coop_members` for API roles.
  Operators use the Supabase dashboard (service role).
- Revisit: self-service onboarding when there are more than ten co-ops.

## D3. Weekly Stripe subscriptions with `price_data`
- Context: each co-op has a few plans; prices change once or twice a year.
- Decision: Checkout in `subscription` mode with inline `price_data`
  (`recurring.interval = "week"`) built from `box_plans.weekly_price_cents`.
- Accepted: Stripe creates a Price per checkout. A price change applies to new
  subscriptions only; existing ones keep their price until we migrate them
  (roadmap). Simpler than syncing a Price catalogue for the pilot.

## D4. A skip is a credit, not a pause
- Context: Stripe can pause payment collection, but a pause per week is fragile
  (resume dates, proration) and invisible in our database.
- Decision: a skip is a row in `skips` (primary key: subscription and delivery
  date); its `credit_cents` is set by a trigger from the plan's price; the server
  then creates a negative customer balance transaction, which Stripe deducts
  from the next invoice.
- Accepted: a skip is final (no delete grant). The customer pays the full price
  that week and gets the credit on the next payment.

## D5. The cut-off is checked by the database
- Context: "skip until Wednesday 18:00 Paris time" must hold even if the form is
  stale or the request is forged.
- Decision: the insert policy on `skips` calls `private.can_skip()`: own active
  subscription, the co-op's weekday, before the local cut-off, at most 56 days
  ahead. The TypeScript copy (`src/lib/deliveries/schedule.ts`) only drives the
  interface; a database test checks that both give the same instant across a
  change of time.

## D6. Out-of-order Stripe events: the event's time wins
- Context: Stripe does not guarantee the order of events; retries arrive late.
- Decision: `subscriptions.status_changed_at` stores `event.created` of the
  event that set the status; `sync_subscription` applies an event only if it is
  not older. Processed event ids are kept in `stripe_events` (duplicates ignored).

## D7. Failed payments: no box
- Context: packing a box costs the co-op money.
- Decision: `past_due` subscriptions are not counted in the packing list, and
  cannot skip (nothing to credit). They are counted again as soon as Stripe
  reports the payment.

## D8. Missing credits are retried daily, never twice
- Context: the skip is saved first, then the Stripe credit is created. If Stripe
  is unreachable, or its answer is lost, the row has no `stripe_credit_id`.
- Decision: `/api/cron/reconcile` (Vercel Cron, daily) lists those skips with
  `pending_skip_credits()`. For each, it first looks for a balance transaction
  with the same metadata since the skip (an answer lost on the way back), and
  only creates a credit if there is none. Stripe's idempotency keys are not
  enough on their own: Stripe may forget them after 24 hours.
- Accepted: a credit may arrive one payment later than usual.

## D9. No real-time and no file storage in the MVP
- Context: chapters 13-14 built both for CrewDeck.
- Decision: not used here. The packing list is final at the cut-off and printed
  once; box contents are a short text list. Adding either would add moving parts
  (channels, buckets, policies) without a user need. Revisit for photos (v1.2).

## D10. The packing list after the cut-off
- Context: skips close at the cut-off, but a payment can still fail, or a
  subscription end, between the cut-off and the delivery.
- Decision: the list is computed live, marked "Final" after the cut-off; staff
  print it at the cut-off. The Stripe portal is configured to cancel at the end
  of the billing period, so a paid week is always packed.
- Accepted: a failed renewal on Thursday removes a box from a list already
  printed; staff see it on the screen. Snapshotting the list is on the roadmap
  if this happens in practice.

## D11. Module boundaries enforced by ESLint
- Decision: `src/lib` never imports `src/app` or `src/components`; the secret-key
  client is used only in `src/lib/billing/store.ts` (and created in
  `src/lib/supabase/admin.ts`). See docs/ARCHITECTURE.md and
  `tests/unit/architecture.test.ts`.

## D12. Time zones without a date library
- Context: the first version used `@date-fns/tz` for one conversion. Its
  `TZDate` reads the current time (`new Date()`) internally, and Next.js stopped
  the prerendering of a Client Component that used it.
- Decision: `zonedTimeToInstant()` uses `Intl.DateTimeFormat` (offset of the
  zone at an instant), corrected once around changes of time; tested on both
  changes of time, west of UTC and in UTC.

## D13. Whose Stripe account? One per installation, for the pilot
- Context: payments must reach the co-op that packs the boxes. One installation
  with one `STRIPE_SECRET_KEY` collects every payment into a single account.
- Decision: during the pilot there is one co-op, and the installation uses the
  co-op's own Stripe account (FarmCrate operates it on the co-op's behalf, by
  contract). No second co-op takes payments on this installation until each
  co-op has its own connected account (Stripe Connect, roadmap).
- Accepted: the multi-tenant schema is ready before the payments are.
