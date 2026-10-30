import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";

const headers = securityHeaders({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  isDev: process.env.NODE_ENV !== "production",
  https: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
});

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
