-- =====================================================================
-- MON STOCK — Étape 4 : verrouiller aussi la base pour les comptes expirés
-- À coller dans Supabase > SQL Editor > Run (APRÈS supabase-abonnement.sql).
-- Un compte dont l'accès est fini peut encore VOIR ses produits et ventes,
-- mais ne peut plus en ajouter ni en modifier. Ne supprime aucune donnée.
-- =====================================================================
drop policy if exists "own products" on public.products;
drop policy if exists "own products read" on public.products;
drop policy if exists "own products write" on public.products;
create policy "own products read" on public.products for select using (user_id = auth.uid());
create policy "own products write" on public.products for all
  using (user_id = auth.uid() and public.ms_has_access())
  with check (user_id = auth.uid() and public.ms_has_access());

drop policy if exists "own movements" on public.movements;
drop policy if exists "own movements read" on public.movements;
drop policy if exists "own movements write" on public.movements;
create policy "own movements read" on public.movements for select using (user_id = auth.uid());
create policy "own movements write" on public.movements for all
  using (user_id = auth.uid() and public.ms_has_access())
  with check (user_id = auth.uid() and public.ms_has_access());
