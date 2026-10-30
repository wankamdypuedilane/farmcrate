import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Link problem" };

export default function AuthErrorPage() {
  return (
    <AuthCard
      title="This link no longer works"
      description="Confirmation and reset links expire after one hour and can be used only once."
    >
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/forgot-password">Reset password</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
