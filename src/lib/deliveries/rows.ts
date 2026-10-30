import { canSkip, type CoopSchedule, deliveryCutoff, upcomingDeliveries } from "./schedule";

export type DeliveryRow = {
  date: string; // YYYY-MM-DD
  label: string; // "Friday 4 December"
  status: "planned" | "skipped" | "closed";
  cutoffLabel: string; // "Changes close Wednesday 2 December at 18:00"
};

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

/**
 * The next deliveries of a subscription, as the account page shows them. With
 * `activatedAt`, deliveries whose changes closed before the payment are left
 * out: the first box is the first delivery after the payment.
 */
export function deliveryRows(
  schedule: CoopSchedule,
  skipped: string[],
  now: Date,
  count = 4,
  activatedAt?: Date,
): DeliveryRow[] {
  const cutoffFormat = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: schedule.timeZone,
  });
  const dates = upcomingDeliveries(schedule, now, count + 1)
    .filter((date) => !activatedAt || activatedAt < deliveryCutoff(schedule, date))
    .slice(0, count);
  return dates.map((date) => ({
    date,
    label: dayLabel(date),
    status: skipped.includes(date) ? "skipped" : canSkip(schedule, date, now) ? "planned" : "closed",
    cutoffLabel: `Changes close ${cutoffFormat.format(deliveryCutoff(schedule, date))}`,
  }));
}
