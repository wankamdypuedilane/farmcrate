import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/current-user";
import { deliveryRows } from "@/lib/deliveries/rows";
import { getCatalog, scheduleOf } from "@/lib/shop/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Packing list", robots: { index: false } };

export default function PackingPage({ params }: PageProps<"/[coop]/packing">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-12">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Packing params={params} />
      </Suspense>
    </main>
  );
}

async function Packing({ params }: { params: PageProps<"/[coop]/packing">["params"] }) {
  const { coop: slug } = await params;
  await requireUser(`/${slug}/packing`);
  const catalog = await getCatalog(slug);
  if (!catalog) notFound();
  await connection();
  const [next] = deliveryRows(scheduleOf(catalog.coop), [], new Date(), 1);
  // The function returns rows only to the co-op's staff.
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("packing_list", { p_coop: catalog.coop.id, p_delivery: next!.date });
  if (error) throw new Error("Could not load the packing list");
  const list = (rows ?? []) as { pickup_point: string; plan: string; boxes: number }[];
  const total = list.reduce((sum, row) => sum + row.boxes, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Packing list: {next!.label}</h1>
      <p className="text-muted-foreground">
        {next!.status === "closed" ? "Final: changes are closed." : `Provisional. ${next!.cutoffLabel}.`}
      </p>
      {list.length === 0 ? (
        <p>No boxes to pack, or you are not on this co-op&apos;s team.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b"><th className="py-2">Pickup point</th><th>Box</th><th className="text-right">Boxes</th></tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={`${row.pickup_point}-${row.plan}`} className="border-b">
                <td className="py-2">{row.pickup_point}</td><td>{row.plan}</td><td className="text-right tabular-nums">{row.boxes}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th className="py-2" colSpan={2}>Total</th><td className="text-right font-semibold tabular-nums">{total}</td></tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
