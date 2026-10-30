import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <p className="text-sm font-medium text-primary">For farm co-ops and their neighbours</p>
      <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">A weekly box from the farms nearby, collected near you.</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Choose a box and a pickup point, skip the weeks you are away, and pay each week. Farmers know
        on Wednesday evening exactly how many boxes to prepare.
      </p>
      <div>
        <Button asChild size="lg">
          <Link href="/monts-darree">Visit the Monts d&apos;Arrée Farm Co-op</Link>
        </Button>
      </div>
    </main>
  );
}
