import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SubscribeForm } from "@/components/shop/subscribe-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deliveryRows } from "@/lib/deliveries/rows";
import { getBoxContents, getCatalog, scheduleOf } from "@/lib/shop/queries";
import { subscribe } from "./actions";

export default function ShopPage({ params }: PageProps<"/[coop]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Shop params={params} />
      </Suspense>
    </main>
  );
}

async function Shop({ params }: { params: PageProps<"/[coop]">["params"] }) {
  const { coop: slug } = await params;
  const catalog = await getCatalog(slug); // cached, public
  if (!catalog) notFound();
  await connection(); // the next delivery depends on today's date
  const [next] = deliveryRows(scheduleOf(catalog.coop), [], new Date(), 1);
  const [user, contents] = await Promise.all([getCurrentUser(), getBoxContents(catalog.coop.id, next!.date)]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{catalog.coop.name}</h1>
        <p className="text-muted-foreground">
          Next delivery: {next!.label}. {next!.cutoffLabel}.
        </p>
      </div>
      <section aria-labelledby="contents" className="space-y-2">
        <h2 id="contents" className="text-xl font-semibold">In this week&apos;s box</h2>
        {contents ? (
          <ul className="flex flex-wrap gap-2">
            {contents.map((item) => (
              <li key={item} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">The farmers announce the contents on Monday.</p>
        )}
      </section>
      <SubscribeForm
        coopSlug={catalog.coop.slug}
        plans={catalog.plans}
        pickupPoints={catalog.pickupPoints}
        signedIn={user !== null}
        action={subscribe}
      />
    </div>
  );
}
