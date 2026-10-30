import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "./env";

// A client without cookies, for public data that is the same for every visitor.
// Because it never reads the request, its results can be cached ("use cache").
export function createPublicClient() {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
