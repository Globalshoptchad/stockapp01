-- =====================================================================
-- MON STOCK — à coller UNE FOIS dans Supabase > SQL Editor > Run
-- (dans le NOUVEAU projet Supabase, pas celui de GlobalShop)
-- =====================================================================

-- 1) Produits
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  barcode text,
  photo_url text,
  created_at timestamptz not null default now()
);
create unique index if not exists products_user_barcode
  on public.products (user_id, barcode) where barcode is not null;

-- 2) Mouvements de stock (entrée = 'in', vente = 'out')
create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index if not exists movements_product on public.movements (product_id, created_at desc);
create index if not exists movements_user_date on public.movements (user_id, created_at);

-- 3) Sécurité : chaque commerçant ne voit QUE ses données
alter table public.products enable row level security;
alter table public.movements enable row level security;

drop policy if exists "own products" on public.products;
create policy "own products" on public.products
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own movements" on public.movements;
create policy "own movements" on public.movements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) Vue : stock calculé par la base (entrées, sorties) — pas de limite de 1000 lignes
create or replace view public.product_stock
with (security_invoker = true) as
select
  p.id, p.user_id, p.name, p.barcode, p.photo_url, p.created_at,
  coalesce(sum(m.quantity) filter (where m.type = 'in'), 0)::int  as total_in,
  coalesce(sum(m.quantity) filter (where m.type = 'out'), 0)::int as total_out
from public.products p
left join public.movements m on m.product_id = p.id
group by p.id;

-- 5) Bilan sur une période : vendu / reçu sur la période + stock actuel
create or replace function public.period_report(since timestamptz)
returns table (
  product_id uuid, name text, photo_url text,
  sold bigint, entered bigint, stock bigint
)
language sql
stable
security invoker
as $$
  select
    p.id, p.name, p.photo_url,
    coalesce(sum(m.quantity) filter (where m.type = 'out' and m.created_at >= since), 0) as sold,
    coalesce(sum(m.quantity) filter (where m.type = 'in'  and m.created_at >= since), 0) as entered,
    coalesce(sum(case when m.type = 'in' then m.quantity else -m.quantity end), 0) as stock
  from public.products p
  left join public.movements m on m.product_id = p.id
  where p.user_id = auth.uid()
  group by p.id;
$$;

-- 6) Stockage des photos (dossier = identifiant du commerçant)
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects
  for select using (bucket_id = 'product-photos');

drop policy if exists "photos insert own" on storage.objects;
create policy "photos insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos update own" on storage.objects;
create policy "photos update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);
