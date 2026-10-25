-- =====================================================================
-- MON STOCK — Étape 2 : prix, chiffre d'affaires et bénéfice
-- (déjà appliqué sur le projet ; à coller dans SQL Editor pour un nouveau projet,
--  APRÈS supabase-setup.sql)
-- =====================================================================

-- 1) Prix sur chaque produit
--    pack_size        = nombre de pièces dans un carton (1 si vendu à l'unité)
--    buy_price        = prix d'ACHAT d'un carton (FCFA)
--    sell_price       = prix de VENTE d'un carton (FCFA)
--    sell_price_piece = prix de vente d'UNE pièce (vide = prix du carton ÷ pièces)
alter table public.products add column if not exists pack_size integer not null default 1 check (pack_size >= 1);
alter table public.products add column if not exists buy_price numeric(14,2) not null default 0 check (buy_price >= 0);
alter table public.products add column if not exists sell_price numeric(14,2) not null default 0 check (sell_price >= 0);
alter table public.products add column if not exists sell_price_piece numeric(14,2) check (sell_price_piece >= 0);

-- 2) Chaque mouvement se souvient s'il a été fait en carton ou en pièce
--    (la quantité est toujours enregistrée en PIÈCES)
alter table public.movements add column if not exists unit text not null default 'piece' check (unit in ('piece', 'pack'));

-- 3) Calculs (toujours avec les prix ACTUELS : changer un prix recalcule tout)
create or replace function public.move_revenue(p public.products, m public.movements)
returns numeric language sql immutable as $$
  select case
    when m.unit = 'pack' then m.quantity * p.sell_price / p.pack_size
    else m.quantity * coalesce(p.sell_price_piece, p.sell_price / p.pack_size)
  end;
$$;

-- 4) Vue des produits : stock + argent
create or replace view public.product_stock
with (security_invoker = true) as
select
  p.id, p.user_id, p.name, p.barcode, p.photo_url, p.created_at,
  coalesce(sum(m.quantity) filter (where m.type = 'in'), 0)::int  as total_in,
  coalesce(sum(m.quantity) filter (where m.type = 'out'), 0)::int as total_out,
  p.pack_size, p.buy_price, p.sell_price, p.sell_price_piece,
  round(coalesce(sum(public.move_revenue(p, m)) filter (where m.type = 'out'), 0))::bigint as revenue,
  round(coalesce(sum(m.quantity * p.buy_price / p.pack_size) filter (where m.type = 'out'), 0))::bigint as cost_sold,
  round(coalesce(sum(m.quantity * p.buy_price / p.pack_size) filter (where m.type = 'in'), 0))::bigint as cost_in
from public.products p
left join public.movements m on m.product_id = p.id
group by p.id;

-- 5) Bilan sur une période
drop function if exists public.period_report(timestamptz);
create function public.period_report(since timestamptz)
returns table (
  product_id uuid, name text, photo_url text,
  sold bigint, entered bigint, stock bigint,
  pack_size int, buy_price numeric, sell_price numeric, sell_price_piece numeric,
  revenue bigint, cost_sold bigint, stock_value bigint, total_in bigint
)
language sql stable security invoker as $$
  select
    p.id, p.name, p.photo_url,
    coalesce(sum(m.quantity) filter (where m.type = 'out' and m.created_at >= since), 0)::bigint as sold,
    coalesce(sum(m.quantity) filter (where m.type = 'in'  and m.created_at >= since), 0)::bigint as entered,
    coalesce(sum(case when m.type = 'in' then m.quantity else -m.quantity end), 0)::bigint as stock,
    p.pack_size, p.buy_price, p.sell_price, p.sell_price_piece,
    round(coalesce(sum(public.move_revenue(p, m)) filter (where m.type = 'out' and m.created_at >= since), 0))::bigint as revenue,
    round(coalesce(sum(m.quantity * p.buy_price / p.pack_size) filter (where m.type = 'out' and m.created_at >= since), 0))::bigint as cost_sold,
    round(coalesce(sum(case when m.type = 'in' then m.quantity else -m.quantity end), 0) * p.buy_price / p.pack_size)::bigint as stock_value,
    coalesce(sum(m.quantity) filter (where m.type = 'in'), 0)::bigint as total_in
  from public.products p
  left join public.movements m on m.product_id = p.id
  where p.user_id = auth.uid()
  group by p.id;
$$;
