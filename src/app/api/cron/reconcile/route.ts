import { NextResponse } from "next/server";
import { reconcileDeps } from "@/lib/billing/operations";
import { reconcileSkipCredits } from "@/lib/billing/reconcile";
import { hasStripe } from "@/lib/billing/stripe";
import { serverEnv } from "@/lib/env.server";
import { log } from "@/lib/log";
import { isCronAuthorized } from "@/lib/security/cron";

const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Called once a day by Vercel Cron (vercel.json): credits the skips that could
// not be credited at the time. Safe to call again: nothing is credited twice.
export async function GET(request: Request) {
  if (!serverEnv.CRON_SECRET) return reply({ error: "Scheduled jobs are not configured." }, 503);
  if (!isCronAuthorized(request.headers.get("authorization"), serverEnv.CRON_SECRET)) {
    return reply({ error: "Unauthorized" }, 401);
  }
  if (!hasStripe || !serverEnv.SUPABASE_SECRET_KEY) return reply({ error: "Billing is not configured." }, 503);

  const report = await reconcileSkipCredits(reconcileDeps);
  log(report.failed > 0 ? "warn" : "info", "Skip credits reconciled", report);
  return reply(report);
}
