import { cacheLife, cacheTag } from "next/cache";
import type { CoopSchedule } from "@/lib/deliveries/schedule";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

export type Coop = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  delivery_weekday: number;
  cutoff_days: number;
  cutoff_time: string;
};
export type Plan = { id: string; name: string; description: string; weekly_price_cents: number };
export type PickupPoint = { id: string; name: string; address: string };
export type Catalog = { coop: Coop; plans: Plan[]; pickupPoints: PickupPoint[] };

export const scheduleOf = (coop: Coop): CoopSchedule => ({
  timeZone: coop.timezone,
  deliveryWeekday: coop.delivery_weekday,
  cutoffDays: coop.cutoff_days,
  cutoffTime: coop.cutoff_time,
});

/** A public co-op's shop window. Cached: the same for every visitor. */
export async function getCatalog(slug: string): Promise<Catalog | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`coop:${slug}`);

  if (!hasSupabaseEnv) return null;
  const supabase = createPublicClient();
  const { data: coop } = await supabase
    .from("coops")
    .select("id, slug, name, timezone, delivery_weekday, cutoff_days, cutoff_time")
    .eq("slug", slug)
    .maybeSingle<Coop>();
  if (!coop) return null;
  const [plans, pickupPoints] = await Promise.all([
    supabase.from("box_plans").select("id, name, description, weekly_price_cents").eq("coop_id", coop.id).order("weekly_price_cents"),
    supabase.from("pickup_points").select("id, name, address").eq("coop_id", coop.id).order("name"),
  ]);
  if (plans.error || pickupPoints.error) throw new Error("Could not load the shop");
  return { coop, plans: plans.data, pickupPoints: pickupPoints.data };
}

/** What is in the box of one delivery, if the co-op has announced it. */
export async function getBoxContents(coopId: string, deliveryDate: string): Promise<string[] | null> {
  if (!hasSupabaseEnv) return null;
  const { data } = await createPublicClient()
    .from("box_contents")
    .select("items")
    .eq("coop_id", coopId)
    .eq("delivery_date", deliveryDate)
    .maybeSingle<{ items: string[] }>();
  return data?.items ?? null;
}
