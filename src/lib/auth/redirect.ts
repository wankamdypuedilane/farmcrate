/**
 * Returns a safe in-app path to redirect to after sign-in.
 * Only relative paths on this site are accepted: anything else would allow an
 * "open redirect", where a link to our sign-in page sends users to a phishing site.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next) return fallback;
  // Must start with a single "/" (not "//evil.com" or "/\evil.com").
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Reject anything that parses as a different origin.
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
