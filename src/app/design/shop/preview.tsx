"use client";

import { SubscribeForm } from "@/components/shop/subscribe-form";
import type { PickupPoint, Plan } from "@/lib/shop/queries";

// Sample data and an in-memory action: no database, no Stripe, no account.
const plans: Plan[] = [
  { id: "00000000-0000-4000-8000-0000000000a1", name: "Small box", description: "Vegetables for one or two people, about 4 kg.", weekly_price_cents: 1800 },
  { id: "00000000-0000-4000-8000-0000000000a2", name: "Family box", description: "Vegetables, eggs and bread for a family, about 8 kg.", weekly_price_cents: 2900 },
];
const pickupPoints: PickupPoint[] = [
  { id: "00000000-0000-4000-8000-0000000000b1", name: "Huelgoat covered market", address: "Place du Marché, Huelgoat" },
  { id: "00000000-0000-4000-8000-0000000000b2", name: "Sizun community hall", address: "Rue de l'Argoat, Sizun" },
];

export function ShopPreview() {
  return (
    <SubscribeForm
      coopSlug="monts-darree"
      plans={plans}
      pickupPoints={pickupPoints}
      signedIn
      action={async (_state, formData) => ({
        status: "error",
        message: `Preview: Stripe Checkout would open for plan ${String(formData.get("planId")).slice(-2)} at pickup ${String(formData.get("pickupPointId")).slice(-2)}.`,
      })}
    />
  );
}
