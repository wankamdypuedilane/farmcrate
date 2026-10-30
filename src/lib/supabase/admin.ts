import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env.server";
import { supabaseUrl } from "./env";

/**
 * Privileged client using the SECRET key: it bypasses Row Level Security.
 * Import it only in narrow server functions that need it (account deletion),
 * never in components or general data access code.
 */
export function createAdminClient() {
  const secretKey = serverEnv.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not configured");
  }
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
