-- FarmCrate: skips whose Stripe credit is still missing (Stripe was unreachable
-- when the customer skipped). A daily job retries them.

-- Found by the daily job: kept small, because it only holds the rows still waiting.
create index skips_pending_credit_idx on public.skips (created_at)
  where stripe_credit_id is null;

create function public.pending_skip_credits(p_limit integer default 50)
returns table (
  subscription_id uuid,
  delivery_date date,
  credit_cents integer,
  stripe_customer_id text,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select k.subscription_id, k.delivery_date, k.credit_cents, p.stripe_customer_id, k.created_at
  from public.skips k
  join public.subscriptions s on s.id = k.subscription_id
  join public.profiles p on p.id = s.customer_id
  where k.stripe_credit_id is null
    and k.credit_cents > 0
    and p.stripe_customer_id is not null
  order by k.created_at
  limit least(greatest(p_limit, 1), 200);
$$;

revoke execute on function public.pending_skip_credits(integer) from public, anon, authenticated;
grant execute on function public.pending_skip_credits(integer) to service_role;
