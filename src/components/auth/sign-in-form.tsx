"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
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
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <div className="flex items-center justify-between">
        <Link href="/forgot-password" className="text-sm text-primary underline underline-offset-4 hover:no-underline">
          Forgot your password?
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
