import { z } from "zod";

/** The subscribe form sends ids only; prices are read on the server. */
export const subscribeSchema = z.object({
  coopSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  planId: z.uuid("Choose a box."),
  pickupPointId: z.uuid("Choose a pickup point."),
});

export const skipSchema = z.object({
  subscriptionId: z.uuid(),
  deliveryDate: z.iso.date(),
});

const formatter = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
/** Display only: integer cents divided by 100 format exactly to two decimals. */
export const formatMoney = (cents: number) => formatter.format(cents / 100);
