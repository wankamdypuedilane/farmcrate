# FarmCrate launch checklist (pilot: Monts d'Arrée Farm Co-op)

Tick every line before the first real payment. Each item says how to check it.

## Code and tests
- [ ] CI green on `main`: lint, typecheck, unit, database, advisors, build, end-to-end.
- [ ] `npm audit --omit=dev` without high or critical findings.
- [ ] axe passes in light and dark mode; keyboard walk-through of subscribe, skip and packing pages.
- [ ] Usability test: five customers of the pilot co-op subscribe on their phones (PRD goal 4).

## Supabase (production project, separate from staging)
- [ ] All migrations applied with `supabase db push` from CI; Security Advisor without warnings.
- [ ] Auth: Site URL and redirect URLs list only the production domain; SMTP on our own domain.
- [ ] The co-op, its pickup points, plans, team and time zone entered and checked by Léna.
- [ ] Backups: daily backups (Pro) at least; restore drill run and dated.
- [ ] MFA on every Supabase, Vercel, GitHub and Stripe account of the team.

## Stripe (the switch from test mode to live mode)
- [ ] Account activated (business details, bank account); statement descriptor "FARMCRATE".
- [ ] The env schema accepts live keys only after this checklist: change it in a reviewed pull request.
- [ ] Live keys as restricted keys where possible, stored only in Vercel's Production environment.
- [ ] Webhook endpoint `https://<domain>/api/stripe/webhook` created in live mode for
      `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`;
      its signing secret set as `STRIPE_WEBHOOK_SECRET`.
- [ ] Customer portal configured: update card, cancel **at the end of the billing period** (D10),
      return URL `/account`.
- [ ] Smart Retries and failed-payment e-mails reviewed (Billing settings).
- [ ] One real subscription by a team member, one skip, one cancellation; refund issued.

## Vercel
- [ ] Production variables set (see `.env.example`), including `CRON_SECRET`.
- [ ] Preview deployments use the staging Supabase project and Stripe test mode.
- [ ] Domain verified, HTTPS, security headers present (`curl -I`), no CSP violation in the console.
- [ ] Cron job `/api/cron/reconcile` visible in the project settings; one manual run returns `pending: 0`.

## People and operations
- [ ] Privacy notice and terms published (payment by Stripe, data kept, contact).
- [ ] Uptime monitor on `/api/health`; alerts reach two people.
- [ ] Léna knows where the packing list is and who to call; first three Wednesdays watched together.
- [ ] Rollback rehearsed: Vercel Instant Rollback; database changes only forward (new migration).
