-- FarmCrate: co-ops (the tenants), their staff, pickup points, box plans and
-- the weekly contents of the boxes.

-- 1. People ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  -- Written by server code only (no column grant below).
  stripe_customer_id text unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- 2. Co-ops and their staff ----------------------------------------------------

create table public.coops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  name text not null check (char_length(name) between 2 and 80),
  -- An IANA zone name: delivery days and cut-offs are local wall-clock times.
  timezone text not null default 'Europe/Paris',
  -- ISO weekday of the weekly delivery: 1 = Monday ... 7 = Sunday.
  delivery_weekday smallint not null check (delivery_weekday between 1 and 7),
  -- Changes close at cutoff_time, cutoff_days before the delivery day.
  cutoff_days smallint not null default 2 check (cutoff_days between 1 and 6),
  cutoff_time time not null default '18:00',
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'staff');

create table public.coop_members (
  coop_id uuid not null references public.coops (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'staff',
  primary key (coop_id, user_id)
);

create index coop_members_user_idx on public.coop_members (user_id);

create schema private;
grant usage on schema private to authenticated;

-- Is the current user part of this co-op's team? Used by many policies.
create function private.is_coop_staff(p_coop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.coop_members
    where coop_id = p_coop and user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_coop_staff(uuid) from public, anon;
grant execute on function private.is_coop_staff(uuid) to authenticated;

alter table public.coops enable row level security;
alter table public.coop_members enable row level security;

create policy "Visitors read public co-ops"
  on public.coops for select to anon
  using (is_public);

create policy "Users read public co-ops and their own"
  on public.coops for select to authenticated
  using (is_public or (select private.is_coop_staff(id)));

create policy "Members read their co-op's team"
  on public.coop_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_coop_staff(coop_id)));

-- Co-ops and teams are set up by FarmCrate's operators (service role), not through the API.
revoke insert, update, delete on public.coops, public.coop_members from anon, authenticated;

-- 3. What a co-op sells, and where -------------------------------------------

create table public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  coop_id uuid not null references public.coops (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  address text not null default '' check (char_length(address) <= 200),
  is_active boolean not null default true
);

create table public.box_plans (
  id uuid primary key default gen_random_uuid(),
  coop_id uuid not null references public.coops (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  -- Money in integer cents.
  weekly_price_cents integer not null check (weekly_price_cents > 0),
  is_active boolean not null default true
);

-- What is in the boxes of one delivery, announced by the co-op.
create table public.box_contents (
  coop_id uuid not null references public.coops (id) on delete cascade,
  delivery_date date not null,
  items text[] not null check (cardinality(items) between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (coop_id, delivery_date)
);

create index pickup_points_coop_idx on public.pickup_points (coop_id);
create index box_plans_coop_idx on public.box_plans (coop_id);

alter table public.pickup_points enable row level security;
alter table public.box_plans enable row level security;
alter table public.box_contents enable row level security;

-- Is this co-op public? (A helper keeps the policies short and identical.)
create function private.is_public_coop(p_coop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.coops where id = p_coop and is_public);
$$;

revoke execute on function private.is_public_coop(uuid) from public;
grant usage on schema private to anon;
grant execute on function private.is_public_coop(uuid) to anon, authenticated;

create policy "Anyone reads active pickup points of public co-ops"
  on public.pickup_points for select to anon, authenticated
  using (is_active and (select private.is_public_coop(coop_id)));
create policy "Staff read all their pickup points"
  on public.pickup_points for select to authenticated
  using ((select private.is_coop_staff(coop_id)));
create policy "Staff manage their pickup points"
  on public.pickup_points for all to authenticated
  using ((select private.is_coop_staff(coop_id)))
  with check ((select private.is_coop_staff(coop_id)));

create policy "Anyone reads active plans of public co-ops"
  on public.box_plans for select to anon, authenticated
  using (is_active and (select private.is_public_coop(coop_id)));
create policy "Staff read all their plans"
  on public.box_plans for select to authenticated
  using ((select private.is_coop_staff(coop_id)));
create policy "Staff manage their plans"
  on public.box_plans for all to authenticated
  using ((select private.is_coop_staff(coop_id)))
  with check ((select private.is_coop_staff(coop_id)));

create policy "Anyone reads box contents of public co-ops"
  on public.box_contents for select to anon, authenticated
  using ((select private.is_public_coop(coop_id)));
create policy "Staff manage their box contents"
  on public.box_contents for all to authenticated
  using ((select private.is_coop_staff(coop_id)))
  with check ((select private.is_coop_staff(coop_id)));

revoke insert, update, delete on public.pickup_points, public.box_plans, public.box_contents from anon;
