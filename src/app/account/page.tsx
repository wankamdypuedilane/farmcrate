import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeliveryList } from "@/components/account/delivery-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMySubscriptions } from "@/lib/account/queries";
import { requireUser } from "@/lib/auth/current-user";
import { formatMoney } from "@/lib/billing/schemas";
import { deliveryRows } from "@/lib/deliveries/rows";
import { scheduleOf } from "@/lib/shop/queries";
import { manageBilling, skipDelivery } from "./actions";

export const metadata: Metadata = { title: "My boxes", robots: { index: false } };

const statusBadge = {
  active: { label: "Active", variant: "success" },
  past_due: { label: "Payment failed", variant: "warning" },
  canceled: { label: "Cancelled", variant: "secondary" },
  incomplete: { label: "Not paid", variant: "outline" },
} as const;

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-12">
      <h1 className="text-3xl font-bold">My boxes</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Subscriptions />
      </Suspense>
    </main>
  );
}

async function Subscriptions() {
  const user = await requireUser("/account");
  const subscriptions = await getMySubscriptions(user.id);
  if (subscriptions.length === 0) {
    return (
      <p className="text-muted-foreground">
        No subscription yet. <Link href="/monts-darree" className="text-primary underline underline-offset-4">Choose a box</Link>
      </p>
    );
  }
  const now = new Date();
  return (
    <div className="space-y-8">
      {subscriptions.map((s) => (
        <section key={s.id} aria-labelledby={`s-${s.id}`} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`s-${s.id}`} className="text-xl font-semibold">
              {s.coops.name}: {s.box_plans.name}, {formatMoney(s.box_plans.weekly_price_cents)} a week
            </h2>
            <Badge variant={statusBadge[s.status].variant}>{statusBadge[s.status].label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Pickup: {s.pickup_points.name}</p>
          {s.status === "active" && (
            <DeliveryList
              subscriptionId={s.id}
              deliveries={deliveryRows(
                scheduleOf(s.coops),
                s.skips.map((k) => k.delivery_date),
                now,
                4,
                s.activated_at ? new Date(s.activated_at) : undefined,
              )}
              action={skipDelivery}
            />
          )}
        </section>
      ))}
      <form action={manageBilling}>
        <Button type="submit" variant="outline">Payment details and cancellation</Button>
      </form>
    </div>
  );
}
