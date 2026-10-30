"use client";

import { useActionState } from "react";
import type { SkipState } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import type { DeliveryRow } from "@/lib/deliveries/rows";


type DeliveryListProps = {
  subscriptionId: string;
  deliveries: DeliveryRow[];
  action: (state: SkipState, formData: FormData) => Promise<SkipState>;
};

function SkipButton({ subscriptionId, date, action }: { subscriptionId: string; date: string; action: DeliveryListProps["action"] }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="deliveryDate" value={date} />
      <Button type="submit" variant="outline" size="sm" disabled={pending || state.status === "done"}>
        {pending ? "Skipping…" : "Skip this week"}
      </Button>
      <span aria-live="polite" className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {state.message}
      </span>
    </form>
  );
}

export function DeliveryList({ subscriptionId, deliveries, action }: DeliveryListProps) {
  return (
    <ul className="divide-y rounded-lg border">
      {deliveries.map((d) => (
        <li key={d.date} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div>
            <p className="font-medium">{d.label}</p>
            <p className="text-sm text-muted-foreground">
              {d.status === "skipped" ? "Skipped: credited on your next payment" : d.cutoffLabel}
            </p>
          </div>
          {d.status === "planned" && <SkipButton subscriptionId={subscriptionId} date={d.date} action={action} />}
          {d.status === "closed" && <span className="text-sm text-muted-foreground">Being prepared</span>}
        </li>
      ))}
    </ul>
  );
}
