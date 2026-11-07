-- =====================================================================
-- Pro-clean LCK — v2 : comptes clients, demandes, CRUD et espace admin
-- À exécuter une fois dans Supabase > SQL Editor (après supabase.sql)
-- =====================================================================

-- ---------- Profils (1 par compte) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  full_name  text check (full_name is null or char_length(full_name) between 2 and 60),
  phone      text check (phone is null or char_length(phone) <= 30),
  area       text check (area is null or char_length(area) <= 60),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Est-ce que la personne connectée est admin ?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
grant select, update on public.profiles to authenticated;

-- Un client ne peut pas se donner le rôle admin
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    new.is_admin := old.is_admin;
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, left(new.raw_user_meta_data->>'full_name', 60), left(new.raw_user_meta_data->>'phone', 30));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Supprimer son propre compte (et tout ce qui va avec)
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Avis : liés au compte, modifiables / supprimables ----------
alter table public.reviews add column if not exists user_id uuid references auth.users on delete cascade default auth.uid();
alter table public.reviews add column if not exists updated_at timestamptz;

drop policy if exists "lire les avis visibles" on public.reviews;
drop policy if exists "ajouter un avis" on public.reviews;
drop policy if exists reviews_select on public.reviews;
drop policy if exists reviews_insert on public.reviews;
drop policy if exists reviews_update on public.reviews;
drop policy if exists reviews_delete on public.reviews;
revoke insert on public.reviews from anon;

create policy reviews_select on public.reviews for select to anon, authenticated
  using (visible or user_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and visible);
create policy reviews_update on public.reviews for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy reviews_delete on public.reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant select on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;

-- Seul l'admin peut masquer / réafficher un avis
create or replace function public.reviews_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    new.visible := old.visible;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard before update on public.reviews for each row execute function public.reviews_guard();

-- ---------- Demandes de service ----------
create table if not exists public.requests (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz,
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  name           text not null check (char_length(name) between 2 and 60),
  phone          text not null check (char_length(phone) between 6 and 30),
  services       text[] not null check (cardinality(services) between 1 and 6),
  area           text check (area is null or char_length(area) <= 60),
  freq           text not null default 'Ponctuel' check (freq in ('Ponctuel','Hebdomadaire','Mensuel')),
  preferred_date date,
  message        text check (message is null or char_length(message) <= 1000),
  status         text not null default 'en_attente' check (status in ('en_attente','confirmee','terminee','annulee')),
  admin_note     text check (admin_note is null or char_length(admin_note) <= 500)
);
alter table public.requests enable row level security;

drop policy if exists requests_select on public.requests;
drop policy if exists requests_insert on public.requests;
drop policy if exists requests_update on public.requests;
drop policy if exists requests_delete on public.requests;
create policy requests_select on public.requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy requests_insert on public.requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'en_attente' and admin_note is null);
create policy requests_update on public.requests for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy requests_delete on public.requests for delete to authenticated
  using ((user_id = auth.uid() and status in ('annulee','terminee')) or public.is_admin());
grant select, insert, update, delete on public.requests to authenticated;

-- Règles côté client : modifier tant que « en attente », annuler tant que pas terminée
create or replace function public.requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    new.user_id := old.user_id;
    new.admin_note := old.admin_note;
    new.created_at := old.created_at;
    if new.status is distinct from old.status then
      if new.status <> 'annulee' or old.status not in ('en_attente','confirmee') then
        raise exception 'Vous pouvez seulement annuler une demande en attente ou confirmée.';
      end if;
    end if;
    if old.status <> 'en_attente' and
       (new.name, new.phone, new.services, new.area, new.freq, new.preferred_date, new.message)
       is distinct from
       (old.name, old.phone, old.services, old.area, old.freq, old.preferred_date, old.message) then
      raise exception 'Cette demande ne peut plus être modifiée.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists requests_guard on public.requests;
create trigger requests_guard before update on public.requests for each row execute function public.requests_guard();
