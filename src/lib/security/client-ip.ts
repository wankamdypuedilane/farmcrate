/**
 * The visitor's IP address, as reported by the hosting platform. On Vercel,
 * x-forwarded-for is set by the platform (a value sent by the client is
 * overwritten), so its first entry is the client. Behind another proxy, check
 * which header that proxy sets before trusting any of them.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  // Keep keys short and harmless: an IPv4 or IPv6 address has at most 45 characters.
  return ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : "unknown";
}
