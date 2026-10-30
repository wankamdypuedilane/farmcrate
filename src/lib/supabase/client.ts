import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

// Supabase client for Client Components (code that runs in the browser).
// createBrowserClient returns the same instance on every call.
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
