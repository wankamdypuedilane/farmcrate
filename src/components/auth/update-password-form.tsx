"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.password}
      />
      <FormField
        name="confirm"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirm}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
