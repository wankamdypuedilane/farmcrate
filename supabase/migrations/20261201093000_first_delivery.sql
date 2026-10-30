-- FarmCrate: a new subscriber's first box is the first delivery whose cut-off
-- comes after the payment is confirmed. A box paid on Thursday is not in the
-- packing list printed on Wednesday evening.

alter table public.subscriptions add column activated_at timestamptz;

-- Subscriptions activated before this migration: their creation time is the best we know.
update public.subscriptions set activated_at = created_at where status <> 'incomplete';

create or replace function public.activate_subscription(
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
         activated_at = coalesce(activated_at, p_event_at),
         status_changed_at = greatest(status_changed_at, p_event_at)
   where id = s.id;
  return 'activated';
end;
$$;

create or replace function public.packing_list(p_coop uuid, p_delivery date)
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
    -- Paid before this delivery's changes closed.
    and s.activated_at < (select private.delivery_cutoff(p_coop, p_delivery))
    and (select private.is_coop_staff(p_coop))
    and not exists (
      select 1 from public.skips k
      where k.subscription_id = s.id and k.delivery_date = p_delivery
    )
  group by pp.name, bp.name
  order by pp.name, bp.name;
$$;

-- "create or replace" keeps the privileges set by the earlier migration; repeated
-- here so that this file states them too.
revoke execute on function public.packing_list(uuid, date) from public, anon;
grant execute on function public.packing_list(uuid, date) to authenticated;
revoke execute on function public.activate_subscription(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.activate_subscription(uuid, text, text, timestamptz) to service_role;
