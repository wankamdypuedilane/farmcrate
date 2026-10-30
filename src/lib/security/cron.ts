import { timingSafeEqual } from "node:crypto";

/**
 * Checks "Authorization: Bearer <secret>", the header Vercel Cron sends, in
 * constant time: how long the comparison takes reveals nothing about the secret.
 */
export function isCronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
