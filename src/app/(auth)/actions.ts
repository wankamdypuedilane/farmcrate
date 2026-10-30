"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  type FormState,
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth/schemas";
import { safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/current-user";
import { serverEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

function invalid(error: z.ZodError): FormState {
  return {
    status: "error",
    message: "Please correct the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { fullName, email, password } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // Stored in auth.users.raw_user_meta_data and read by the handle_new_user trigger.
    options: { data: { full_name: fullName } },
  });

  if (error) {
    // Supabase returns a "weak password" error with a code we can surface safely.
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: [error.message] } };
    }
    return { status: "error", message: "We could not create your account. Please try again." };
  }
  // Same answer whether or not the address was already registered (no account enumeration).
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Never say which of the two was wrong.
    return { status: "error", message: "Invalid e-mail or password." };
  }
  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${serverEnv.NEXT_PUBLIC_SITE_URL}/update-password`,
  });
  // Same message in every case, so the form cannot be used to discover accounts.
  return {
    status: "success",
    message: "If an account exists for this address, we have sent a reset link.",
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Your reset link has expired. Please request a new one." };
  }
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: "We could not update your password. Please try again." };
  }
  redirect("/account");
}
