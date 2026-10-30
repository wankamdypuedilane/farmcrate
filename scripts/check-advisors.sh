#!/usr/bin/env bash
# Applies the migrations to a temporary database and runs Supabase's security
# advisors on it: tables without Row Level Security, functions with a mutable
# search_path, and more. Fails on any warning. Used by CI.
# Usage: DATABASE_URL=postgresql://user:pass@host:5432/postgres scripts/check-advisors.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"

DB="advisors_check_$$"
DB_URL="$(python3 -c "import sys,urllib.parse as u; p=u.urlsplit(sys.argv[1]); print(u.urlunsplit(p._replace(path='/' + sys.argv[2])))" "$DATABASE_URL" "$DB")"
trap 'psql "$DATABASE_URL" -q -c "drop database if exists $DB" >/dev/null' EXIT

psql "$DATABASE_URL" -q -c "create database $DB"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase-shim.sql >/dev/null
for migration in supabase/migrations/*.sql; do
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

# The CLI expects TLS by default; a CI service container has none.
case "$DB_URL" in *\?*) SEP="&" ;; *) SEP="?" ;; esac
npx supabase db advisors --db-url "${DB_URL}${SEP}sslmode=disable" --type security --fail-on warn
