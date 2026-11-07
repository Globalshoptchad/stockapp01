-- =====================================================================
-- MON STOCK — Étape 3 : abonnement, réglages, équipe d'administration
-- (déjà appliqué sur le projet ; pour un nouveau projet, à coller dans
--  SQL Editor APRÈS supabase-setup.sql et supabase-prix.sql)
-- Ne supprime aucune donnée.
-- =====================================================================

-- 1) Réglages de l'app (modifiables depuis l'espace administrateur)
create table if not exists public.settings (
  key   text primary key,
  value text not null default ''
);
insert into public.settings (key, value) values
  ('price_month', '2000'),      -- prix d'un mois (FCFA)
  ('trial_days', '30'),         -- durée de l'essai gratuit (jours)
  ('airtel_number', ''),        -- numéro Airtel Money qui reçoit les paiements
  ('moov_number', ''),          -- numéro Moov Money qui reçoit les paiements
  ('whatsapp_number', ''),      -- numéro WhatsApp où le client signale son paiement
  ('signup_open', 'true'),      -- nouvelles inscriptions ouvertes ?
  ('feature_scan', 'true'),     -- bouton « scanner le code-barres » visible ?
  ('announcement', '')          -- message affiché en haut de l'app pour tous
on conflict (key) do nothing;
alter table public.settings enable row level security;
-- (aucune règle : on lit et on écrit seulement via les fonctions ci-dessous)

-- 2) Équipe d'administration : toi (owner) + tes aides avec leurs droits
create table if not exists public.staff (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  is_owner      boolean not null default false,   -- peut gérer l'équipe
  perm_accounts boolean not null default true,    -- voir les comptes, activer après paiement, bloquer
  perm_settings boolean not null default false,   -- changer prix, numéros, fonctionnalités
  added_at      timestamptz not null default now()
);
alter table public.staff enable row level security;

-- 3) Abonnement de chaque commerçant
create table if not exists public.accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  paid_until timestamptz not null,               -- accès jusqu'à cette date (essai ou payé)
  blocked    boolean not null default false,     -- bloqué à la main par un admin
  created_at timestamptz not null default now()
);
alter table public.accounts enable row level security;

-- 4) Historique des paiements validés
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  months       integer not null check (months between 1 and 24),
  amount       integer not null default 0,
  operator     text not null default '' check (operator in ('', 'airtel', 'moov', 'cash')),
  activated_by uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists payments_user on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;

-- ---------- Petites fonctions utiles ----------
create or replace function public.ms_setting(p_key text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = p_key), '');
$$;

-- Un nouveau compte reçoit automatiquement son essai gratuit
create or replace function public.ms_new_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.accounts (user_id, paid_until)
    values (new.id, now() + make_interval(days => coalesce(nullif(public.ms_setting('trial_days'), '')::int, 30)))
    on conflict (user_id) do nothing;
  exception when others then
    null; -- ne JAMAIS empêcher une inscription
  end;
  return new;
end $$;
drop trigger if exists ms_on_auth_user_created on auth.users;
create trigger ms_on_auth_user_created after insert on auth.users
  for each row execute function public.ms_new_account();

-- Réglages visibles par tout le monde (même avant connexion)
create or replace function public.ms_public_settings()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'price_month', public.ms_setting('price_month'),
    'trial_days', public.ms_setting('trial_days'),
    'airtel_number', public.ms_setting('airtel_number'),
    'moov_number', public.ms_setting('moov_number'),
    'whatsapp_number', public.ms_setting('whatsapp_number'),
    'signup_open', public.ms_setting('signup_open'),
    'feature_scan', public.ms_setting('feature_scan'),
    'announcement', public.ms_setting('announcement')
  );
$$;
grant execute on function public.ms_public_settings() to anon, authenticated;

-- État du commerçant connecté (crée son essai s'il n'en a pas encore :
-- les comptes d'avant l'abonnement commencent leur mois gratuit ici)
create or replace function public.ms_my_status()
returns json language plpgsql security definer set search_path = public as $$
declare a public.accounts; s public.staff;
begin
  if auth.uid() is null then return null; end if;
  insert into public.accounts (user_id, paid_until)
  values (auth.uid(), now() + make_interval(days => coalesce(nullif(public.ms_setting('trial_days'), '')::int, 30)))
  on conflict (user_id) do nothing;
  select * into a from public.accounts where user_id = auth.uid();
  select * into s from public.staff where user_id = auth.uid();
  return json_build_object(
    'paid_until', a.paid_until,
    'blocked', a.blocked,
    'has_paid', exists (select 1 from public.payments p where p.user_id = auth.uid()),
    'access', (s.user_id is not null) or (not a.blocked and a.paid_until > now()),
    'staff', case when s.user_id is null then null else json_build_object(
      'owner', s.is_owner, 'accounts', s.perm_accounts or s.is_owner, 'settings', s.perm_settings or s.is_owner) end,
    'settings', public.ms_public_settings()
  );
end $$;

-- Accès autorisé ? (servira à verrouiller aussi la base, voir étape 5)
create or replace function public.ms_has_access()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
      or not exists (select 1 from public.accounts where user_id = auth.uid())
      or exists (select 1 from public.accounts where user_id = auth.uid() and not blocked and paid_until > now());
$$;

-- ---------- Espace administrateur ----------
create or replace function public.ms_require(p_perm text)
returns void language plpgsql stable security definer set search_path = public as $$
declare s public.staff;
begin
  select * into s from public.staff where user_id = auth.uid();
  if s.user_id is null
     or (p_perm = 'accounts' and not (s.perm_accounts or s.is_owner))
     or (p_perm = 'settings' and not (s.perm_settings or s.is_owner))
     or (p_perm = 'owner' and not s.is_owner) then
    raise exception 'non autorisé';
  end if;
end $$;

-- Liste des commerçants (recherche par numéro ou nom du commerce)
create or replace function public.ms_admin_accounts(p_search text default '')
returns table (
  user_id uuid, phone text, shop_name text, created_at timestamptz,
  paid_until timestamptz, blocked boolean, has_paid boolean,
  products bigint, last_activity timestamptz
) language plpgsql stable security definer set search_path = public as $$
declare q text := regexp_replace(coalesce(p_search, ''), '\s', '', 'g');
begin
  perform public.ms_require('accounts');
  return query
  select u.id,
         split_part(u.email, '@', 1),
         coalesce(u.raw_user_meta_data ->> 'shop_name', ''),
         u.created_at,
         a.paid_until,
         coalesce(a.blocked, false),
         exists (select 1 from public.payments p where p.user_id = u.id),
         (select count(*) from public.products p where p.user_id = u.id),
         (select max(m.created_at) from public.movements m where m.user_id = u.id)
  from auth.users u
  left join public.accounts a on a.user_id = u.id
  where q = ''
     or split_part(u.email, '@', 1) like '%' || regexp_replace(q, '\D', '', 'g') || '%' and regexp_replace(q, '\D', '', 'g') <> ''
     or (u.raw_user_meta_data ->> 'shop_name') ilike '%' || p_search || '%'
  order by u.created_at desc
  limit 200;
end $$;

-- Valider un paiement : ajoute des mois à partir d'aujourd'hui (ou de la fin de l'accès en cours)
create or replace function public.ms_admin_activate(p_user uuid, p_months int, p_operator text default '')
returns timestamptz language plpgsql security definer set search_path = public as $$
declare until timestamptz; price int;
begin
  perform public.ms_require('accounts');
  if p_months is null or p_months < 1 or p_months > 24 then raise exception 'nombre de mois invalide'; end if;
  price := coalesce(nullif(regexp_replace(public.ms_setting('price_month'), '\D', '', 'g'), '')::int, 0);
  insert into public.accounts (user_id, paid_until) values (p_user, now()) on conflict (user_id) do nothing;
  update public.accounts
     set paid_until = greatest(paid_until, now()) + make_interval(days => 30 * p_months),
         blocked = false
   where user_id = p_user
  returning paid_until into until;
  insert into public.payments (user_id, months, amount, operator, activated_by)
  values (p_user, p_months, price * p_months, coalesce(p_operator, ''), auth.uid());
  return until;
end $$;

create or replace function public.ms_admin_set_blocked(p_user uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.ms_require('accounts');
  insert into public.accounts (user_id, paid_until) values (p_user, now()) on conflict (user_id) do nothing;
  update public.accounts set blocked = p_blocked where user_id = p_user;
end $$;

create or replace function public.ms_admin_payments(p_user uuid)
returns table (months int, amount int, operator text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.ms_require('accounts');
  return query select p.months, p.amount, p.operator, p.created_at
    from public.payments p where p.user_id = p_user order by p.created_at desc limit 50;
end $$;

create or replace function public.ms_admin_stats()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform public.ms_require('accounts');
  return json_build_object(
    'accounts', (select count(*) from auth.users),
    'active', (select count(*) from public.accounts a where not a.blocked and a.paid_until > now()),
    'paying', (select count(*) from public.accounts a where not a.blocked and a.paid_until > now()
                 and exists (select 1 from public.payments p where p.user_id = a.user_id)),
    'expired', (select count(*) from public.accounts a where a.blocked or a.paid_until <= now()),
    'month_amount', (select coalesce(sum(amount), 0) from public.payments
                      where created_at >= date_trunc('month', now()))
  );
end $$;

create or replace function public.ms_admin_set_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.ms_require('settings');
  if p_key not in ('price_month', 'trial_days', 'airtel_number', 'moov_number', 'whatsapp_number',
                   'signup_open', 'feature_scan', 'announcement') then
    raise exception 'réglage inconnu';
  end if;
  insert into public.settings (key, value) values (p_key, left(coalesce(p_value, ''), 300))
  on conflict (key) do update set value = excluded.value;
end $$;

-- Équipe (réservé au propriétaire)
create or replace function public.ms_admin_team()
returns table (user_id uuid, phone text, shop_name text, is_owner boolean, perm_accounts boolean, perm_settings boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.ms_require('owner');
  return query select s.user_id, split_part(u.email, '@', 1), coalesce(u.raw_user_meta_data ->> 'shop_name', ''),
                      s.is_owner, s.perm_accounts, s.perm_settings
    from public.staff s join auth.users u on u.id = s.user_id order by s.is_owner desc, s.added_at;
end $$;

-- Ajouter / modifier un membre de l'équipe par son numéro d'inscription
create or replace function public.ms_admin_set_staff(p_phone text, p_accounts boolean, p_settings boolean)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  perform public.ms_require('owner');
  if length(digits) < 6 then return 'numero_invalide'; end if;
  select id into uid from auth.users where email = digits || '@monstock-app.com';
  if uid is null then return 'introuvable'; end if;
  if exists (select 1 from public.staff where user_id = uid and is_owner) then return 'proprietaire'; end if;
  insert into public.staff (user_id, perm_accounts, perm_settings) values (uid, p_accounts, p_settings)
  on conflict (user_id) do update set perm_accounts = excluded.perm_accounts, perm_settings = excluded.perm_settings;
  return 'ok';
end $$;

create or replace function public.ms_admin_remove_staff(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.ms_require('owner');
  delete from public.staff where user_id = p_user and not is_owner;  -- le propriétaire ne peut pas être retiré
end $$;

-- Les fonctions d'admin ne sont utilisables que par des comptes connectés (et vérifient les droits)
revoke execute on function public.ms_my_status(), public.ms_admin_accounts(text), public.ms_admin_activate(uuid, int, text),
  public.ms_admin_set_blocked(uuid, boolean), public.ms_admin_payments(uuid), public.ms_admin_stats(),
  public.ms_admin_set_setting(text, text), public.ms_admin_team(), public.ms_admin_set_staff(text, boolean, boolean),
  public.ms_admin_remove_staff(uuid) from public, anon;
grant execute on function public.ms_my_status(), public.ms_admin_accounts(text), public.ms_admin_activate(uuid, int, text),
  public.ms_admin_set_blocked(uuid, boolean), public.ms_admin_payments(uuid), public.ms_admin_stats(),
  public.ms_admin_set_setting(text, text), public.ms_admin_team(), public.ms_admin_set_staff(text, boolean, boolean),
  public.ms_admin_remove_staff(uuid) to authenticated;

-- ---------- Propriétaire ----------
-- Le compte « Tchara commerce1 » reçoit tous les droits d'administration.
insert into public.staff (user_id, is_owner, perm_accounts, perm_settings)
select id, true, true, true from auth.users
where raw_user_meta_data ->> 'shop_name' = 'Tchara commerce1' and email like '0033%@monstock-app.com'
on conflict (user_id) do update set is_owner = true, perm_accounts = true, perm_settings = true;

-- ---------- Étape 5 (au moment de la mise en ligne) ----------
-- Verrouille aussi la base : un compte dont l'accès est fini peut encore VOIR ses données,
-- mais ne peut plus en ajouter ni en modifier.
-- drop policy if exists "own products" on public.products;
-- create policy "own products read" on public.products for select using (user_id = auth.uid());
-- create policy "own products write" on public.products for all
--   using (user_id = auth.uid() and public.ms_has_access()) with check (user_id = auth.uid() and public.ms_has_access());
-- (même chose pour public.movements)
