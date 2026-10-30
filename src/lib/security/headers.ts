// HTTP security headers for every response, applied in next.config.ts.
// Pure: the origins come from configuration, so the policy can be tested.

export type SecurityConfig = {
  /** https://<project>.supabase.co, or http://127.0.0.1:54321 for the local stack. */
  supabaseUrl?: string;
  isDev: boolean;
  /** True when the site is served over HTTPS (production and previews). */
  https: boolean;
};

function origin(url: string | undefined): URL | null {
  try {
    return url ? new URL(url) : null;
  } catch {
    return null;
  }
}

/** The same host with the other protocol of a pair (https <-> wss, http <-> ws). */
function twin(url: URL): string {
  const swap: Record<string, string> = { "https:": "wss:", "wss:": "https:", "http:": "ws:", "ws:": "http:" };
  return `${swap[url.protocol] ?? url.protocol}//${url.host}`;
}

/**
 * A Content Security Policy without nonces. FarmCrate prerenders static shells
 * (Cache Components), which nonces would forbid, so inline scripts stay allowed;
 * the policy still decides where data may be sent, what may frame the site,
 * and which plugins, forms and base URLs are possible.
 */
export function contentSecurityPolicy({ supabaseUrl, isDev, https }: SecurityConfig): string {
  const supabase = origin(supabaseUrl);
  const connect = supabase ? [`${supabase.protocol}//${supabase.host}`, twin(supabase)] : [];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next.js and next-themes inject inline scripts; eval only for development tools.
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'", "https://va.vercel-scripts.com"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(supabase ? [`${supabase.protocol}//${supabase.host}`] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...connect],
    "media-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Forms post to us; payment and billing pages are Stripe's, reached by redirect.
    "form-action": [
      "'self'",
      ...(supabase ? [`${supabase.protocol}//${supabase.host}`] : []),
      "https://checkout.stripe.com",
      "https://billing.stripe.com",
    ],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (https) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(config: SecurityConfig): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(config) },
    // Browsers remember to use HTTPS only, for two years, including subdomains.
    ...(config.https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // FarmCrate needs no camera, microphone or location.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    // Older browsers ignore frame-ancestors; this header says the same thing.
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
