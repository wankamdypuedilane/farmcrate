import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * The signed-in user, verified on the server, or null.
 * getClaims() checks the token signature: never authorize with getSession().
 * cache() deduplicates calls during one request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // The answer depends on the request: never prerender it at build time.
  await connection();
  if (!hasSupabaseEnv) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
});

/** Use at the top of every protected page and Server Action. */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export type Profile = {
  id: string;
  full_name: string;
};

/** The current user's profile. Row Level Security guarantees it is their own row. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .single<Profile>();
  return data ?? null;
});

