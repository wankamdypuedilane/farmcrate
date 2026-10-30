# FarmCrate: maintenance routine and roadmap

## Routine

| When | What | Who |
|---|---|---|
| Every Wednesday after the cut-off | glance at the packing list with the co-op; check the reconciliation log (`pending: 0`) | operator on duty |
| Weekly | merge Dependabot pull requests that pass CI; read Stripe's and Supabase's changelogs | developer |
| Monthly | `npm audit`; Supabase advisors on production; review error logs by digest; Stripe disputes and failed payments | developer |
| Every quarter | restore drill; key rotation (Supabase secret key, Stripe restricted key, `CRON_SECRET`); MFA audit | both |
| Twice a year | upgrade Next.js, Supabase libraries and the Stripe SDK (its pinned API version) on a branch, with the full test suite | developer |

Upgrading the Stripe SDK changes the API version: read the upgrade notes first
(for example, billing periods moved to subscription items in 2025), then run the
billing unit tests and a test-mode subscription end to end.

## v1.1 (pilot feedback, about two months after launch)
- Staff screens: edit box contents, plans and pickup points (RLS policies already exist);
  `updateTag("coop:<slug>")` after each change.
- Change pickup point or plan from "My boxes" (from the next delivery after the cut-off).
- Pause for several weeks in one go (one skip per week, in one transaction).
- E-mail on Wednesday morning: "changes close tonight" (outbox pattern of chapter 16).

## v1.2
- Photos of the week's box (private bucket, signed URLs, chapter 14).
- À-la-carte extras with stock (eggs, cheese).
- French interface (the pilot co-op's customers asked for it).

## Later, when there are more than ten co-ops
- Self-service onboarding of co-ops, each with its own Stripe connected account
  (Stripe Connect) so that money goes directly to the co-op.
- Price changes for existing subscriptions (Stripe Prices per plan instead of `price_data`).
- Snapshot of the packing list at the cut-off, if late changes cause trouble (D10).
