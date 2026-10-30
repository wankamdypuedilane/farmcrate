-- Sample data for local development (fictional): the first co-op on FarmCrate.
insert into public.coops (slug, name, timezone, delivery_weekday, cutoff_days, cutoff_time, is_public)
values ('monts-darree', 'Monts d''Arrée Farm Co-op', 'Europe/Paris', 5, 2, '18:00', true);

insert into public.pickup_points (coop_id, name, address)
select id, p.name, p.address from public.coops, (values
  ('Huelgoat covered market', 'Place du Marché, Huelgoat'),
  ('Kerroc''h farm shop', 'Lieu-dit Kerroc''h, Brasparts'),
  ('Sizun community hall', 'Rue de l''Argoat, Sizun')
) as p(name, address)
where slug = 'monts-darree';

insert into public.box_plans (coop_id, name, description, weekly_price_cents)
select id, p.name, p.description, p.price from public.coops, (values
  ('Small box', 'Vegetables for one or two people, about 4 kg.', 1800),
  ('Family box', 'Vegetables, eggs and bread for a family, about 8 kg.', 2900)
) as p(name, description, price)
where slug = 'monts-darree';

-- This week's and next week's contents (deliveries on Fridays).
insert into public.box_contents (coop_id, delivery_date, items)
select c.id, d.day, d.items
from public.coops c,
  lateral (values
    (current_date + ((5 - extract(isodow from current_date)::int + 7) % 7),
     array['Potatoes', 'Leeks', 'Carrots', 'Kale', 'Apples']),
    (current_date + ((5 - extract(isodow from current_date)::int + 7) % 7) + 7,
     array['Squash', 'Onions', 'Beetroot', 'Salad', 'Pears'])
  ) as d(day, items)
where c.slug = 'monts-darree';
