import type { FormState } from "@/lib/auth/schemas";

// Announces the overall result of a form submission (role="alert" or "status").
export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md bg-success/10 px-3 py-2 text-sm text-foreground"
      }
    >
      {state.message}
    </p>
  );
}
