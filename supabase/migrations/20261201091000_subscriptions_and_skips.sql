-- FarmCrate: weekly box subscriptions (billed by Stripe), skipped weeks and
-- the packing list.

create type public.subscription_status as enum ('incomplete', 'active', 'past_due', 'canceled');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  coop_id uuid not null references public.coops (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  plan_id uuid not null references public.box_plans (id) on delete restrict,
  pickup_point_id uuid not null references public.pickup_points (id) on delete restrict,
  status public.subscription_status not null default 'incomplete',
  checkout_session_id text unique,
  stripe_subscription_id text unique,
  -- Time of the Stripe event that set the status: older events never overwrite newer ones.
  status_changed_at timestamptz not null default now(),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- One open subscription per customer and co-op.
create unique index subscriptions_one_open_idx on public.subscriptions (coop_id, customer_id)
  where status <> 'canceled';
create index subscriptions_customer_idx on public.subscriptions (customer_id);
create index subscriptions_coop_status_idx on public.subscriptions (coop_id, status);

alter table public.subscriptions enable row level security;

create policy "Customers read their subscriptions; staff read their co-op's"
  on public.subscriptions for select to authenticated
  using (customer_id = (select auth.uid()) or (select private.is_coop_staff(coop_id)));

-- Subscriptions change only through server code and Stripe's webhooks.
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- 1. Skipping a week -------------------------------------------------------------

-- The moment changes close for a delivery: cutoff_time, cutoff_days before
-- the delivery date, in the co-op's time zone (daylight saving time included).
create function private.delivery_cutoff(p_coop uuid, p_delivery date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select ((p_delivery - c.cutoff_days) + c.cutoff_time) at time zone c.timezone
  from public.coops c
  where c.id = p_coop;
$$;

-- Can the current user skip this delivery of this subscription?
create function private.can_skip(p_subscription uuid, p_delivery date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.coops c on c.id = s.coop_id
    where s.id = p_subscription
      and s.customer_id = (select auth.uid())
      and s.status = 'active'
      -- A real delivery day of this co-op...
      and extract(isodow from p_delivery) = c.delivery_weekday
      -- ...whose changes are still open...
      and now() < ((p_delivery - c.cutoff_days) + c.cutoff_time) at time zone c.timezone
      -- ...and at most eight weeks ahead.
      and p_delivery <= (now() at time zone c.timezone)::date + 56
  );
$$;

revoke execute on function private.delivery_cutoff(uuid, date), private.can_skip(uuid, date) from public, anon;
grant execute on function private.delivery_cutoff(uuid, date), private.can_skip(uuid, date) to authenticated;

create table public.skips (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  delivery_date date not null,
  -- The price of the skipped box, credited to the customer's Stripe balance.
  credit_cents integer not null default 0 check (credit_cents >= 0),
  -- The Stripe balance transaction (cbtxn_...), once the credit is applied.
  stripe_credit_id text unique,
  created_at timestamptz not null default now(),
  primary key (subscription_id, delivery_date)
);

-- The credit is the plan's weekly price, read by the database, not sent by the browser.
create function private.set_skip_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.weekly_price_cents into new.credit_cents
  from public.subscriptions s join public.box_plans p on p.id = s.plan_id
  where s.id = new.subscription_id;
  return new;
end;
$$;

revoke execute on function private.set_skip_credit() from public, anon, authenticated;

create trigger skips_set_credit
  before insert on public.skips
  for each row execute function private.set_skip_credit();

alter table public.skips enable row level security;

-- Visible to whoever can see the subscription (its customer, its co-op's staff).
create policy "Skips are visible with their subscription"
  on public.skips for select to authenticated
  using (exists (select 1 from public.subscriptions s where s.id = subscription_id));

create policy "Customers skip open deliveries of their active subscription"
  on public.skips for insert to authenticated
  with check ((select private.can_skip(subscription_id, delivery_date)));

-- A skip is final: it is credited and the packing list counts on it.
revoke insert, update, delete on public.skips from anon, authenticated;
grant insert (subscription_id, delivery_date) on public.skips to authenticated;

-- 2. The packing list ----------------------------------------------------------

-- Boxes to pack for one delivery, per pickup point and plan: active
-- subscriptions minus the skips. Staff of the co-op only.
create function public.packing_list(p_coop uuid, p_delivery date)
returns table (pickup_point text, plan text, boxes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select pp.name, bp.name, count(*)::integer
  from public.subscriptions s
  join public.pickup_points pp on pp.id = s.pickup_point_id
  join public.box_plans bp on bp.id = s.plan_id
  where s.coop_id = p_coop
    and s.status = 'active'
    and (select private.is_coop_staff(p_coop))
    and not exists (
      select 1 from public.skips k
      where k.subscription_id = s.id and k.delivery_date = p_delivery
    )
  group by pp.name, bp.name
  order by pp.name, bp.name;
$$;

revoke execute on function public.packing_list(uuid, date) from public, anon;
grant execute on function public.packing_list(uuid, date) to authenticated;

-- 3. Billing transitions, for server code with the secret key ----------------------

-- Opens (or reuses) the customer's pending subscription before Checkout.
create function public.open_subscription(p_customer uuid, p_coop uuid, p_plan uuid, p_pickup uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  existing public.subscriptions;
  new_id uuid;
begin
  if not exists (select 1 from public.coops where id = p_coop and is_public)
     or not exists (select 1 from public.box_plans where id = p_plan and coop_id = p_coop and is_active)
     or not exists (select 1 from public.pickup_points where id = p_pickup and coop_id = p_coop and is_active) then
    raise exception 'plan or pickup point not available' using errcode = 'P0002';
  end if;

  select * into existing from public.subscriptions
  where coop_id = p_coop and customer_id = p_customer and status <> 'canceled'
  for update;

  if found and existing.status <> 'incomplete' then
    raise exception 'already subscribed' using errcode = '23505';
  elsif found then
    -- An abandoned checkout: reuse it with the new choices.
    update public.subscriptions
       set plan_id = p_plan, pickup_point_id = p_pickup, checkout_session_id = null
     where id = existing.id;
    return existing.id;
  end if;

  insert into public.subscriptions (coop_id, customer_id, plan_id, pickup_point_id)
  values (p_coop, p_customer, p_plan, p_pickup)
  returning id into new_id;
  return new_id;
end;
$$;

-- Checkout completed: link the Stripe subscription and activate.
create function public.activate_subscription(
  p_subscription uuid, p_checkout_session text, p_stripe_subscription text, p_event_at timestamptz
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  s public.subscriptions;
begin
  select * into s from public.subscriptions where id = p_subscription for update;
  if not found or s.checkout_session_id is distinct from p_checkout_session then
    return 'mismatch';
  end if;
  if s.stripe_subscription_id = p_stripe_subscription then
    return 'already_linked';
  end if;
  update public.subscriptions
     set stripe_subscription_id = p_stripe_subscription,
         status = 'active',
         status_changed_at = greatest(status_changed_at, p_event_at)
   where id = s.id;
  return 'activated';
end;
$$;

-- A subscription changed at Stripe (renewal, failed payment, cancellation).
-- Events can arrive out of order: an older event never overwrites a newer state.
create function public.sync_subscription(
  p_stripe_subscription text, p_status public.subscription_status,
  p_period_end timestamptz, p_event_at timestamptz
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  update public.subscriptions
     set status = p_status, current_period_end = p_period_end, status_changed_at = p_event_at
   where stripe_subscription_id = p_stripe_subscription
     and status_changed_at <= p_event_at;
  if found then
    return 'updated';
  elsif exists (select 1 from public.subscriptions where stripe_subscription_id = p_stripe_subscription) then
    return 'stale';
  end if;
  return 'unknown';
end;
$$;

-- The Stripe credit for a skip was created: record it once.
create function public.record_skip_credit(p_subscription uuid, p_delivery date, p_credit text)
returns boolean
language sql
set search_path = ''
as $$
  with updated as (
    update public.skips set stripe_credit_id = p_credit
    where subscription_id = p_subscription and delivery_date = p_delivery and stripe_credit_id is null
    returning 1
  )
  select exists (select 1 from updated);
$$;

create table public.stripe_events (
  id text primary key check (id ~ '^evt_'),
  type text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

revoke execute on function
  public.open_subscription(uuid, uuid, uuid, uuid),
  public.activate_subscription(uuid, text, text, timestamptz),
  public.sync_subscription(text, public.subscription_status, timestamptz, timestamptz),
  public.record_skip_credit(uuid, date, text)
from public, anon, authenticated;
grant execute on function
  public.open_subscription(uuid, uuid, uuid, uuid),
  public.activate_subscription(uuid, text, text, timestamptz),
  public.sync_subscription(text, public.subscription_status, timestamptz, timestamptz),
  public.record_skip_credit(uuid, date, text)
to service_role;
