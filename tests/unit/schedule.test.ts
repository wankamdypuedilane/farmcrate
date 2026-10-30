import { describe, expect, it } from "vitest";
import { canSkip, deliveryCutoff, upcomingDeliveries, zonedTimeToInstant } from "@/lib/deliveries/schedule";

// Monts d'Arrée: deliveries on Fridays, changes close on Wednesdays at 18:00, Paris time.
const montsDarree = { timeZone: "Europe/Paris", deliveryWeekday: 5, cutoffDays: 2, cutoffTime: "18:00" };

describe("upcoming deliveries", () => {
  it("start with this week's Friday, today included", () => {
    expect(upcomingDeliveries(montsDarree, new Date("2026-12-02T10:00:00Z"))).toEqual([
      "2026-12-04", "2026-12-11", "2026-12-18", "2026-12-25",
    ]);
    // On a Friday, that Friday is still listed.
    expect(upcomingDeliveries(montsDarree, new Date("2026-12-04T07:00:00Z"), 1)).toEqual(["2026-12-04"]);
  });

  it("use the co-op's calendar, not the server's", () => {
    // 23:30 UTC on Friday 4 December is already Saturday in Paris: the next delivery is the 11th.
    expect(upcomingDeliveries(montsDarree, new Date("2026-12-04T23:30:00Z"), 1)).toEqual(["2026-12-11"]);
  });
});

describe("cut-off", () => {
  it("is 18:00 Paris time two days before, in winter (UTC+1) and summer (UTC+2)", () => {
    expect(deliveryCutoff(montsDarree, "2026-12-04").toISOString()).toBe("2026-12-02T17:00:00.000Z");
    expect(deliveryCutoff(montsDarree, "2027-06-04").toISOString()).toBe("2027-06-02T16:00:00.000Z");
  });

  it("follows the change of time between the cut-off and the delivery", () => {
    // Clocks go forward on Sunday 28 March 2027; the delivery of Friday 2 April closes on
    // Wednesday 31 March at 18:00 summer time.
    expect(deliveryCutoff(montsDarree, "2027-04-02").toISOString()).toBe("2027-03-31T16:00:00.000Z");
  });
});

describe("wall-clock time to instant", () => {
  it("is right on the days the clocks change, west of UTC and in UTC itself", () => {
    expect(zonedTimeToInstant("2027-03-28", "18:00", "Europe/Paris").toISOString()).toBe("2027-03-28T16:00:00.000Z");
    // 01:30 is still winter time in Paris, although 01:30 UTC is already summer time.
    expect(zonedTimeToInstant("2027-03-28", "01:30", "Europe/Paris").toISOString()).toBe("2027-03-28T00:30:00.000Z");
    expect(zonedTimeToInstant("2027-10-31", "18:00", "Europe/Paris").toISOString()).toBe("2027-10-31T17:00:00.000Z");
    expect(zonedTimeToInstant("2026-12-02", "18:00", "America/Toronto").toISOString()).toBe("2026-12-02T23:00:00.000Z");
    expect(zonedTimeToInstant("2026-12-02", "18:00", "UTC").toISOString()).toBe("2026-12-02T18:00:00.000Z");
  });
});

describe("skipping", () => {
  it("is open until the cut-off, then closed", () => {
    expect(canSkip(montsDarree, "2026-12-04", new Date("2026-12-02T16:59:59Z"))).toBe(true);
    expect(canSkip(montsDarree, "2026-12-04", new Date("2026-12-02T17:00:00Z"))).toBe(false);
  });

  it("only concerns real delivery days, up to eight weeks ahead", () => {
    const now = new Date("2026-12-01T09:00:00Z");
    expect(canSkip(montsDarree, "2026-12-05", now)).toBe(false); // a Saturday
    expect(canSkip(montsDarree, "2027-01-22", now)).toBe(true); // 52 days ahead
    expect(canSkip(montsDarree, "2027-02-05", now)).toBe(false); // 66 days ahead
  });
});
