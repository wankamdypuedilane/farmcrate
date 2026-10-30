// Structured logs: one JSON object per line, easy to search and to alert on
// in the hosting platform's log viewer. Secrets and personal data are masked.

type Level = "info" | "warn" | "error";

const SENSITIVE = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|email/i;

/** Copies a value, replacing sensitive fields by "[redacted]", at any depth. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SENSITIVE.test(key) ? "[redacted]" : redact(item, depth + 1)]),
    );
  }
  return value;
}

export function log(level: Level, message: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...(redact(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
