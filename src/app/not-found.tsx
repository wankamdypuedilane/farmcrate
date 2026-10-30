import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-6 py-24">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-3xl font-semibold">We could not find this page</h1>
      <p className="text-muted-foreground">
        The link may be broken, or the page may have been removed.
      </p>
      <Button asChild>
        <Link href="/">Back to FarmCrate</Link>
      </Button>
    </main>
  );
}
