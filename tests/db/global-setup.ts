import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

// Default: the database of the Supabase local stack (`npx supabase start`).
const adminUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const TEST_DB = "farmcrate_test";

export default async function setup() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${TEST_DB}`;
  process.env.TEST_DATABASE_URL = testUrl.toString();

  const db = new Client({ connectionString: testUrl.toString() });
  await db.connect();
  // A fresh database has no Supabase schemas: add the minimal emulation.
  const { rows } = await db.query("select 1 from pg_namespace where nspname = 'auth'");
  if (rows.length === 0) {
    await db.query(readFileSync(join("tests", "db", "supabase-shim.sql"), "utf8"));
  }
  // Apply every migration in order, exactly as `supabase db push` would.
  const dir = join("supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(join(dir, file), "utf8"));
  }
  // Load the sample catalogue, as `supabase db reset` does.
  await db.query(readFileSync(join("supabase", "seed.sql"), "utf8"));
  await db.end();

  return async () => {
    const cleanup = new Client({ connectionString: adminUrl });
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${TEST_DB} with (force)`);
    await cleanup.end();
  };
}
