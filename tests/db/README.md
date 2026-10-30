# Database tests

These tests apply every migration in `supabase/migrations/` to a fresh database
and check Row Level Security policies as an anonymous visitor and as signed-in
users.

```bash
# With the Supabase local stack (requires Docker):
npx supabase start
npm run test:db

# With any PostgreSQL 15+ server:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
```

The setup creates a database named `farmcrate_test`, adds a minimal emulation of
Supabase's `auth` schema and roles when they are missing (`supabase-shim.sql`),
and drops the database at the end.
