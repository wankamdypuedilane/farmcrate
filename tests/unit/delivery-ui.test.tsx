import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeliveryList } from "@/components/account/delivery-list";
import { SubscribeForm } from "@/components/shop/subscribe-form";
import { deliveryRows } from "@/lib/deliveries/rows";

const schedule = { timeZone: "Europe/Paris", deliveryWeekday: 5, cutoffDays: 2, cutoffTime: "18:00" };

describe("deliveryRows", () => {
  it("marks deliveries as closed, open or skipped, with the cut-off in the co-op's time", () => {
    const rows = deliveryRows(schedule, ["2026-12-18"], new Date("2026-12-03T09:00:00Z"));
    expect(rows.map((r) => [r.date, r.status])).toEqual([
      ["2026-12-04", "closed"],
      ["2026-12-11", "planned"],
      ["2026-12-18", "skipped"],
      ["2026-12-25", "planned"],
    ]);
    expect(rows[1]!.label).toBe("Friday 11 December");
    expect(rows[1]!.cutoffLabel).toBe("Changes close Wednesday 9 December at 18:00");
  });

  it("starts with the first delivery after the payment", () => {
    // Paid on Thursday 3 December: Friday the 4th closed on Wednesday, so the first box is the 11th.
    const now = new Date("2026-12-03T09:00:00Z");
    const rows = deliveryRows(schedule, [], now, 4, new Date("2026-12-03T08:55:00Z"));
    expect(rows.map((r) => r.date)).toEqual(["2026-12-11", "2026-12-18", "2026-12-25", "2027-01-01"]);
    // Paid before the cut-off: Friday the 4th is the first box.
    expect(deliveryRows(schedule, [], now, 4, new Date("2026-12-02T16:59:00Z"))[0]!.date).toBe("2026-12-04");
  });
});

describe("DeliveryList", () => {
  it("offers a skip button only for open deliveries and sends ids and the date", async () => {
    const action = vi.fn(async () => ({ status: "done" as const, message: "Skipped." }));
    const rows = deliveryRows(schedule, ["2026-12-18"], new Date("2026-12-03T09:00:00Z"));
    render(<DeliveryList subscriptionId="00000000-0000-4000-8000-0000000000c1" deliveries={rows} action={action} />);
    const buttons = screen.getAllByRole("button", { name: "Skip this week" });
    expect(buttons).toHaveLength(2);
    await userEvent.setup().click(buttons[0]!);
    expect(await screen.findByText("Skipped.")).toBeInTheDocument();
    const sent = Object.fromEntries((action.mock.calls[0] as unknown as [unknown, FormData])[1]);
    expect(sent).toEqual({ subscriptionId: "00000000-0000-4000-8000-0000000000c1", deliveryDate: "2026-12-11" });
  });
});

describe("SubscribeForm", () => {
  const plans = [
    { id: "00000000-0000-4000-8000-0000000000a1", name: "Small box", description: "", weekly_price_cents: 1800 },
    { id: "00000000-0000-4000-8000-0000000000a2", name: "Family box", description: "", weekly_price_cents: 2900 },
  ];
  const pickups = [{ id: "00000000-0000-4000-8000-0000000000b1", name: "Huelgoat covered market", address: "Huelgoat" }];

  it("shows the weekly price of the chosen box on the button", async () => {
    render(<SubscribeForm coopSlug="monts-darree" plans={plans} pickupPoints={pickups} signedIn action={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Subscribe for €18.00 a week" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("radio", { name: /Family box/ }));
    expect(screen.getByRole("button", { name: "Subscribe for €29.00 a week" })).toBeInTheDocument();
  });

  it("asks visitors to sign in first", () => {
    render(<SubscribeForm coopSlug="monts-darree" plans={plans} pickupPoints={pickups} signedIn={false} action={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Sign in to subscribe" })).toHaveAttribute("href", "/sign-in?next=%2Fmonts-darree");
  });
});
