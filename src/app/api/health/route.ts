import { connection } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

// For uptime monitors: 200 when the site and its database answer, 503 otherwise.
// It reveals no configuration, only what a monitor needs.
export async function GET() {
  await connection(); // never cached: each call checks again
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  let database: "ok" | "down" | "not configured" = "not configured";
  if (hasSupabaseEnv) {
    const { error } = await createPublicClient()
      .from("mentor_profiles")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    database = error ? "down" : "ok";
  }
  const healthy = database !== "down";
  return Response.json(
    { status: healthy ? "ok" : "error", database, version },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
