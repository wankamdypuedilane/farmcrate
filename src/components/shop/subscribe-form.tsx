"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { SubscribeState } from "@/app/[coop]/actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/billing/schemas";
import type { PickupPoint, Plan } from "@/lib/shop/queries";

type SubscribeFormProps = {
  coopSlug: string;
  plans: Plan[];
  pickupPoints: PickupPoint[];
  signedIn: boolean;
  action: (state: SubscribeState, formData: FormData) => Promise<SubscribeState>;
};

export function SubscribeForm({ coopSlug, plans, pickupPoints, signedIn, action }: SubscribeFormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border bg-card p-5 text-card-foreground">
      <input type="hidden" name="coopSlug" value={coopSlug} />
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Your box</legend>
        {plans.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary">
            <input type="radio" name="planId" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} className="mt-1" />
            <span className="flex-1">
              <span className="font-medium">{p.name}</span>{" "}
              <span className="text-muted-foreground">· {formatMoney(p.weekly_price_cents)} a week</span>
              <span className="block text-sm text-muted-foreground">{p.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="pickupPointId" className="block font-semibold">Pickup point</label>
        <select id="pickupPointId" name="pickupPointId" required defaultValue=""
          className="h-10 w-full rounded-md border border-input bg-background px-3">
          <option value="" disabled>Choose where you collect your box</option>
          {pickupPoints.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.address})</option>
          ))}
        </select>
      </div>

      {state.message && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      {signedIn ? (
        <Button type="submit" className="w-full" disabled={pending || !plan}>
          {pending ? "Opening secure payment…" : `Subscribe for ${plan ? formatMoney(plan.weekly_price_cents) : ""} a week`}
        </Button>
      ) : (
        <Button asChild className="w-full">
          <Link href={`/sign-in?next=${encodeURIComponent(`/${coopSlug}`)}`}>Sign in to subscribe</Link>
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Billed weekly by Stripe. Skip any week before the cut-off and the box is credited; cancel at any time.
      </p>
    </form>
  );
}
