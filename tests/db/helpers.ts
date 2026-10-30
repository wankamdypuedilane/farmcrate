import { Client } from "pg";

export async function connect() {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  return client;
}

/** Creates a user the way Supabase Auth does: a row in auth.users. */
export async function createUser(
  client: Client,
  email: string,
  metadata: Record<string, string> = {},
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(metadata)],
  );
  return rows[0].id;
}

/**
 * Runs `fn` inside a transaction as a signed-in user (role `authenticated`
 * with the user's id in the JWT claims), then rolls everything back.
 */
export async function asUser<T>(client: Client, userId: string, fn: () => Promise<T>) {
  return withRole(client, "authenticated", { sub: userId, role: "authenticated" }, fn);
}

/** Runs `fn` as trusted server code (role `service_role`, the secret key), then rolls back. */
export async function asService<T>(client: Client, fn: () => Promise<T>) {
  return withRole(client, "service_role", { role: "service_role" }, fn);
}

/** Runs `fn` as an anonymous visitor (role `anon`), then rolls back. */
export async function asAnon<T>(client: Client, fn: () => Promise<T>) {
  return withRole(client, "anon", { role: "anon" }, fn);
}

async function withRole<T>(
  client: Client,
  role: "anon" | "authenticated" | "service_role",
  claims: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims),
    ]);
    return await fn();
  } finally {
    await client.query("rollback");
  }
}
