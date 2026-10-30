@AGENTS.md

# FarmCrate: instructions for coding agents

FarmCrate sells weekly vegetable boxes of farm co-operatives by subscription:
customers choose a box and a pickup point, pay weekly with Stripe and skip the
weeks they are away; co-op staff get the packing list at the cut-off.
Read docs/PRD.md before planning a feature, docs/DECISIONS.md before changing
the data model or billing, docs/ARCHITECTURE.md for module boundaries.

## Stack
- Next.js 16 (App Router, `src/`, Cache Components), React 19, TypeScript 5, Tailwind 4, shadcn/ui
- Supabase (Postgres, Auth) through `@supabase/ssr`; Stripe Node SDK (pinned API version)
- Vitest (`tests/unit`), database tests (`tests/db`), Playwright (`tests/e2e`)

## Commands
- `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`
- `npm run test:db` (needs DATABASE_URL or `npx supabase start`)
- Run lint, typecheck, unit and database tests before saying a task is done, and show the output.

## Rules
- Server Components by default; "use client" only for interactivity. Request data inside <Suspense>.
- Authorize with `supabase.auth.getClaims()`; never trust `getSession()` on the server.
- Every table has RLS and explicit policies; every co-op-owned table has `coop_id`.
  Schema changes are new files in `supabase/migrations/`; never edit an applied migration.
- Money is integer cents. The browser sends ids and dates, never amounts or credits.
- Times are `timestamptz`; delivery days and cut-offs are computed in the co-op's time zone,
  identically in SQL (`private.can_skip`) and TypeScript (`src/lib/deliveries/schedule.ts`),
  with tests across changes of time.
- Billing state changes only through the service-role SQL functions, from `src/lib/billing/store.ts`
  (the only module allowed to use the secret-key client). Every Stripe POST has an idempotency key.
- The Stripe webhook verifies the signature on the raw body. Events may arrive twice or out of order.
- Stripe runs in TEST MODE only (the env schema refuses live keys). Never read or commit `.env*`
  files except `.env.example`; never hard-code keys.
- Validate all user input on the server with zod. Use semantic design tokens, never raw colours.
- Catalogue data is public and cached (`coop:<slug>` tag); customer and staff data is never cached.
- Do not modify tests to make them pass unless the requirement changed; say so explicitly if you do.
- Keep changes small; propose a plan first for anything touching more than three files.
- Hooks in .claude/settings.json lint edited files and block destructive commands; run the
  code-reviewer subagent and /ship-check before a pull request.
