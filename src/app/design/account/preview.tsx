"use client";

import { DeliveryList } from "@/components/account/delivery-list";
import { deliveryRows } from "@/lib/deliveries/rows";

const schedule = { timeZone: "Europe/Paris", deliveryWeekday: 5, cutoffDays: 2, cutoffTime: "18:00" };
// Fixed "now": Thursday 3 December 2026, after Wednesday's cut-off for the 4th.
const now = new Date("2026-12-03T09:00:00Z");

export function AccountPreview() {
  return (
    <DeliveryList
      subscriptionId="00000000-0000-4000-8000-0000000000c1"
      deliveries={deliveryRows(schedule, ["2026-12-18"], now)}
      action={async () => ({ status: "done", message: "Skipped. The box price will be deducted from your next payment." })}
    />
  );
}
