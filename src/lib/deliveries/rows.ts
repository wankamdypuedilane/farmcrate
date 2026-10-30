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

/** The next deliveries of a subscription, as the account page shows them. */
export function deliveryRows(schedule: CoopSchedule, skipped: string[], now: Date, count = 4): DeliveryRow[] {
  const cutoffFormat = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: schedule.timeZone,
  });
  return upcomingDeliveries(schedule, now, count).map((date) => ({
    date,
    label: dayLabel(date),
    status: skipped.includes(date) ? "skipped" : canSkip(schedule, date, now) ? "planned" : "closed",
    cutoffLabel: `Changes close ${cutoffFormat.format(deliveryCutoff(schedule, date))}`,
  }));
}
