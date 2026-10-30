import { z } from "zod";

// Length matters more than complexity rules (NIST SP 800-63B).
// 72 is the maximum number of bytes bcrypt (used by Supabase Auth) takes into account.
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use at most 72 characters.");

const emailSchema = z.email("Enter a valid e-mail address.").max(254);

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(100),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((data) => data.password === data.confirm, {
    message: "The passwords do not match.",
    path: ["confirm"],
  });

/** State returned by every auth form action (used with useActionState). */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

export const initialFormState: FormState = { status: "idle" };
