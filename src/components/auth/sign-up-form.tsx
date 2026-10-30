"use client";

import { useActionState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="fullName"
        label="Full name"
        autoComplete="name"
        required
        errors={state.fieldErrors?.fullName}
      />
      <FormField
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        errors={state.fieldErrors?.email}
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters. A short sentence is easy to remember and hard to guess."
        errors={state.fieldErrors?.password}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
