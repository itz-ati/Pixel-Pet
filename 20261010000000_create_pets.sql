-- One pet per user. Each user can only see and change their own pet.
create table if not exists public.pets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default 'Buddy',
  hunger     real not null default 70 check (hunger between 0 and 100),
  energy     real not null default 80 check (energy between 0 and 100),
  mood       real not null default 70 check (mood   between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.pets enable row level security;

create policy "pets: read own"   on public.pets for select to authenticated
  using (auth.uid() = user_id);

create policy "pets: insert own" on public.pets for insert to authenticated
  with check (auth.uid() = user_id);

create policy "pets: update own" on public.pets for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
