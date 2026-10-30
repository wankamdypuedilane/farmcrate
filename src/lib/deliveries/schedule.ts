// Delivery rules, as pure functions. The database applies the same rule
// (private.can_skip); tests/db/skips.test.ts checks that both agree.

export type CoopSchedule = {
  /** IANA time zone of the co-op, such as "Europe/Paris". */
  timeZone: string;
  /** ISO weekday of the delivery: 1 = Monday ... 7 = Sunday. */
  deliveryWeekday: number;
  /** Changes close `cutoffTime` (HH:MM), `cutoffDays` days before the delivery. */
  cutoffDays: number;
  cutoffTime: string;
};

/** The calendar date (YYYY-MM-DD) in a time zone at a given instant. */
export function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Calendar arithmetic on YYYY-MM-DD strings, independent of any time zone. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay() || 7;
}

/** The next `count` delivery dates, starting today in the co-op's time zone. */
export function upcomingDeliveries(schedule: CoopSchedule, now: Date, count = 4): string[] {
  const today = localDate(now, schedule.timeZone);
  const first = addDays(today, (schedule.deliveryWeekday - isoWeekday(today) + 7) % 7);
  return Array.from({ length: count }, (_, week) => addDays(first, 7 * week));
}

/** The offset of a time zone from UTC at an instant, in minutes (Paris in winter: 60). */
function offsetMinutes(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value; // "GMT+01:00", or "GMT" for UTC
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  return match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
}

/**
 * The instant of a wall-clock time in a time zone ("18:00 on 2 December in
 * Paris"). Uses only Intl, so it runs anywhere, prerendering included.
 */
export function zonedTimeToInstant(isoDate: string, time: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const asIfUtc = Date.UTC(year!, month! - 1, day!, hours!, minutes!);
  // First guess with the offset at that moment, then correct it once: the two can
  // differ when the clocks change between them.
  const guess = asIfUtc - offsetMinutes(new Date(asIfUtc), timeZone) * 60_000;
  return new Date(asIfUtc - offsetMinutes(new Date(guess), timeZone) * 60_000);
}

/** The instant at which changes close for a delivery (daylight saving time included). */
export function deliveryCutoff(schedule: CoopSchedule, deliveryDate: string): Date {
  return zonedTimeToInstant(addDays(deliveryDate, -schedule.cutoffDays), schedule.cutoffTime, schedule.timeZone);
}

/** Can a delivery still be skipped at `now`? (The subscription's own status is checked by the database.) */
export function canSkip(schedule: CoopSchedule, deliveryDate: string, now: Date): boolean {
  return (
    isoWeekday(deliveryDate) === schedule.deliveryWeekday &&
    now.getTime() < deliveryCutoff(schedule, deliveryDate).getTime() &&
    deliveryDate <= addDays(localDate(now, schedule.timeZone), 56)
  );
}
