-- SmartMarket v2 – hirdetesek tábla és RLS
create table if not exists public.hirdetesek (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text not null,
  category text not null,
  price bigint,
  phone text,
  website text,
  images text[] default '{}'::text[],
  created_at timestamp with time zone default now()
);

alter table public.hirdetesek enable row level security;

-- Saját rekordok írása, mindenki olvas
create policy "Public read" on public.hirdetesek
  for select using (true);

create policy "Users insert own" on public.hirdetesek
  for insert with check (auth.uid() = user_id);

create policy "Users update own" on public.hirdetesek
  for update using (auth.uid() = user_id);

create policy "Users delete own" on public.hirdetesek
  for delete using (auth.uid() = user_id);
