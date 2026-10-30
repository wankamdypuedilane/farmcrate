"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Shown when a page fails on the server or in the browser. It never displays
// the error message itself, which could reveal internal details.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        Please try again. If the problem continues, contact us
        {digest ? <> and mention the reference <code className="font-mono">{digest}</code></> : null}.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
