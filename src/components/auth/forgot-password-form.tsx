"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        errors={state.fieldErrors?.email}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
