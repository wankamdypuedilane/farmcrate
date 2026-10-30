import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Subscribe to a weekly box from farms near you."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary underline underline-offset-4 hover:no-underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
