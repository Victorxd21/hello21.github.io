-- What’s New announcements for Game Hub
-- Run in Supabase SQL Editor

create table if not exists public.hub_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  category text default null,
  link_url text default null,
  link_label text default null,
  important boolean not null default false,
  published boolean not null default false,
  show_in_popup boolean not null default true,
  published_at timestamptz default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hub_announcements_published_idx
  on public.hub_announcements (published, published_at desc);

alter table public.hub_announcements enable row level security;

drop policy if exists "Public read published announcements" on public.hub_announcements;
create policy "Public read published announcements"
  on public.hub_announcements for select
  using (published = true);

drop policy if exists "Auth insert announcements" on public.hub_announcements;
create policy "Auth insert announcements"
  on public.hub_announcements for insert
  to authenticated
  with check (true);

drop policy if exists "Auth update announcements" on public.hub_announcements;
create policy "Auth update announcements"
  on public.hub_announcements for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Auth delete announcements" on public.hub_announcements;
create policy "Auth delete announcements"
  on public.hub_announcements for delete
  to authenticated
  using (true);
