import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabasePublishableKey, supabaseUrl } from "./env";

// Paths that require a signed-in user.
const protectedPrefixes = ["/account"];

// Refreshes the user's session on every matching request and keeps the
// browser and server cookies in sync. Called from src/proxy.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv) return response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Never cache a response that sets auth cookies: it could hand one user's session to another.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Keep this call directly after creating the client: it verifies the
  // access token and refreshes it when it is about to expire.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  // First line of defence: send visitors to sign-in before rendering private pages.
  // Each page and Server Action still checks the user itself.
  const { pathname, search } = request.nextUrl;
  if (!isSignedIn && protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Return this exact response object so the refreshed cookies reach the browser.
  return response;
}
