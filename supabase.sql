-- Pro-clean LCK : table des avis clients
-- À coller dans Supabase > SQL Editor > New query, puis cliquer sur « Run ».

create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 2 and 40),
  area        text check (area is null or char_length(area) <= 40),
  service     text not null check (service in ('Ménage résidentiel','Ménage de bureaux','Salles de bain','Cuisine','Vitres','Grand ménage')),
  rating      smallint not null check (rating between 1 and 5),
  comment     text not null check (char_length(comment) between 10 and 600),
  visible     boolean not null default true   -- mettre à false pour masquer un avis
);

alter table public.reviews enable row level security;

-- Tout le monde peut LIRE les avis visibles
create policy "lire les avis visibles" on public.reviews
  for select to anon using (visible = true);

-- Tout le monde peut AJOUTER un avis (mais pas modifier ni supprimer)
create policy "ajouter un avis" on public.reviews
  for insert to anon with check (visible = true);

-- Droits d'accès pour les visiteurs du site
grant select, insert on public.reviews to anon;
