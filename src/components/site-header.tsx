import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

// "secondary" links are hidden on narrow screens, where the header must fit in 375 pixels.
const navigation = [
  { href: "/monts-darree", label: "Monts d'Arrée", secondary: false },
  { href: "/account", label: "My boxes", secondary: true },
];

export function SiteHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex min-w-0 items-center gap-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-3 ${item.secondary ? "hidden sm:inline-block" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
          <Suspense fallback={<div className="h-8 w-20" />}>
            <AuthButton />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
