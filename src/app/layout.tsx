import type { Metadata } from "next";
// Self-hosted font: served from our own domain, no request to Google.
import "@fontsource-variable/inter";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FarmCrate",
    template: "%s · FarmCrate",
  },
  description: "Weekly produce boxes from farm co-ops, with pickup near you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the `dark` class before React hydrates, hence the warning opt-out.
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
