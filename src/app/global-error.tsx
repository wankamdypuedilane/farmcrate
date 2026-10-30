"use client";

// Replaces the root layout when it fails: no global styles or fonts are
// available here, so the page stays minimal and readable.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: "36rem", margin: "6rem auto", padding: "0 1.5rem" }}>
        <title>Something went wrong · TutorNest</title>
        <h1>Something went wrong</h1>
        <p>Please try again in a moment.</p>
        <button type="button" onClick={() => retry()}>
          Try again
        </button>
      </body>
    </html>
  );
}
