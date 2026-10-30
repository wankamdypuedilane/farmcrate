import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/security/client-ip";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security/headers";

const production = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  isDev: false,
  https: true,
};

const directives = (policy: string) =>
  Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("Content Security Policy", () => {
  it("lets the browser talk only to our site and Supabase", () => {
    const csp = directives(contentSecurityPolicy(production));
    expect(csp["connect-src"]).toEqual(["'self'", "https://abcdefgh.supabase.co", "wss://abcdefgh.supabase.co"]);
    expect(csp["img-src"]).toContain("https://abcdefgh.supabase.co");
  });

  it("forbids plugins, framing by other sites, foreign base URLs and form targets", () => {
    const csp = directives(contentSecurityPolicy(production));
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual([
      "'self'",
      "https://abcdefgh.supabase.co",
      "https://checkout.stripe.com",
      "https://billing.stripe.com",
    ]);
    expect(csp["upgrade-insecure-requests"]).toEqual([]);
  });

  it("allows eval only in development", () => {
    expect(directives(contentSecurityPolicy(production))["script-src"]).not.toContain("'unsafe-eval'");
    const dev = directives(contentSecurityPolicy({ ...production, isDev: true, https: false }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("works with the local Supabase stack", () => {
    const csp = directives(contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", isDev: true, https: false }));
    expect(csp["connect-src"]).toEqual(["'self'", "http://127.0.0.1:54321", "ws://127.0.0.1:54321"]);
  });
});

describe("security headers", () => {
  it("send HSTS only over HTTPS", () => {
    const keys = (https: boolean) => securityHeaders({ ...production, https }).map((h) => h.key);
    expect(keys(true)).toContain("Strict-Transport-Security");
    expect(keys(false)).not.toContain("Strict-Transport-Security");
  });

  it("deny the camera, microphone and location", () => {
    const permissions = securityHeaders(production).find((h) => h.key === "Permissions-Policy");
    expect(permissions?.value).toBe("camera=(), microphone=(), geolocation=(), payment=()");
  });
});

describe("clientIp", () => {
  it("takes the first address set by the platform", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("never returns arbitrary text, which would become part of a database key", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "'; drop table x; --" }))).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
