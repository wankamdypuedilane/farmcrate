import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Check your e-mail" };

export default function CheckEmailPage() {
  return (
    <AuthCard
      title="Check your e-mail"
      description="We have sent you a link to confirm your address. Open it on this device to finish creating your account."
    >
      <p className="text-sm text-muted-foreground">
        No e-mail after a few minutes? Check your spam folder, or sign up again with the correct address.
      </p>
    </AuthCard>
  );
}
