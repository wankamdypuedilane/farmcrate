# FarmCrate

Weekly vegetable boxes from farm co-operatives, by subscription. Customers
choose a box and a pickup point, pay every week by card and skip the weeks they
are away; the co-op gets an exact packing list at the cut-off.

Companion code of chapter 22 (the capstone project) of *Mastering AI-Assisted
Full-Stack Application Development* by WANKAM Dypue Dilane Junior. All names,
co-ops, farms and people are fictional. **Stripe runs in test mode only.**

## What is inside

| | |
|---|---|
| Product | [docs/PRD.md](docs/PRD.md): problem, audience, requirements, user stories, acceptance criteria |
| Decisions | [docs/DECISIONS.md](docs/DECISIONS.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): modules, data model, flows, caching, measured performance |
| Launch | [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) |
| After launch | [docs/ROADMAP.md](docs/ROADMAP.md): maintenance routine and next versions |
| Agents | [CLAUDE.md](CLAUDE.md), `.claude/` (hooks, reviewer subagent, ship-check skill) |

## Run it locally

Requirements: Node.js 22 or later (26 LTS recommended), Docker (for the Supabase local stack), the
Stripe CLI for webhooks.

```bash
npm ci
cp .env.example .env.local        # then fill in your own values (test keys only)
npx supabase start                # local Postgres, Auth and Studio
npx supabase db reset             # applies supabase/migrations and supabase/seed.sql
stripe listen --forward-to localhost:3000/api/stripe/webhook
npm run dev                       # http://localhost:3000
```

The seed creates the public co-op `monts-darree` with two plans and three
pickup points. To see the packing list, add your user to its team in Studio
(table `coop_members`).

## Checks

```bash
npm run lint && npm run typecheck && npm test   # unit tests
npm run test:db                                 # database: RLS, SQL functions, cut-offs
npm run test:e2e                                # Playwright, builds and starts the app
```

CI runs all of them, plus `npm audit` and Supabase's security advisors
(`.github/workflows/ci.yml`).

## Milestones

The branch `ch22-end` is the state described at the end of chapter 22.

## Licence

MIT, see [LICENSE](LICENSE).
