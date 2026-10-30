import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Skeleton } from "@/components/ui/skeleton";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthCard
      title="Sign in"
      description="Welcome back to FarmCrate."
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="text-primary underline underline-offset-4 hover:no-underline">
            Create an account
          </Link>
        </>
      }
    >
      {/* searchParams depend on the request, so they are read inside Suspense. */}
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <SignInFormWithNext searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignInFormWithNext({
  searchParams,
}: {
  searchParams: PageProps<"/sign-in">["searchParams"];
}) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(typeof next === "string" ? next : undefined);
  return <SignInForm next={safeNext} />;
}
