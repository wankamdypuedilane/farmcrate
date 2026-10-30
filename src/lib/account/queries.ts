import "server-only";
import type { Coop } from "@/lib/shop/queries";
import { createClient } from "@/lib/supabase/server";

export type MySubscription = {
  id: string;
  status: "incomplete" | "active" | "past_due" | "canceled";
  current_period_end: string | null;
  activated_at: string | null;
  coops: Coop;
  box_plans: { name: string; weekly_price_cents: number };
  pickup_points: { name: string };
  skips: { delivery_date: string }[];
};

/** The signed-in customer's subscriptions, with what the account page shows. RLS returns their own. */
export async function getMySubscriptions(userId: string): Promise<MySubscription[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, status, current_period_end, activated_at, coops(id, slug, name, timezone, delivery_weekday, cutoff_days, cutoff_time), " +
        "box_plans(name, weekly_price_cents), pickup_points(name), skips(delivery_date)",
    )
    .eq("customer_id", userId)
    .neq("status", "incomplete")
    .order("created_at")
    .overrideTypes<MySubscription[], { merge: false }>();
  if (error) throw new Error("Could not load your subscriptions");
  return data;
}
