-- Game Hub: AI rate limits + secure admin policies
-- Run in Supabase SQL Editor (or via supabase db push).

-- 1) Rate-limit table for AI chat (server-side only; no public access)
create table if not exists public.ai_rate_limits (
  rate_key text primary key,
  last_request_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_rate_limits enable row level security;

-- No public policies — only service role (Edge Function) can read/write
drop policy if exists "Public read rate" on public.ai_rate_limits;
drop policy if exists "Public write rate" on public.ai_rate_limits;

-- 2) Secure featured_games and hub_settings
-- Keep public READ. Restrict WRITE to authenticated users (admins via Supabase Auth).

alter table if exists public.featured_games enable row level security;
alter table if exists public.hub_settings enable row level security;

-- Drop overly permissive anonymous write policies
drop policy if exists "Public insert featured" on public.featured_games;
drop policy if exists "Public update featured" on public.featured_games;
drop policy if exists "Public delete featured" on public.featured_games;
drop policy if exists "Public write settings" on public.hub_settings;
drop policy if exists "Public update settings" on public.hub_settings;
drop policy if exists "Public insert settings" on public.hub_settings;

-- Public read remains
drop policy if exists "Public read featured" on public.featured_games;
create policy "Public read featured"
  on public.featured_games for select
  using (true);

drop policy if exists "Public read settings" on public.hub_settings;
create policy "Public read settings"
  on public.hub_settings for select
  using (true);

-- Authenticated writes only (create an admin user in Authentication → Users)
drop policy if exists "Auth insert featured" on public.featured_games;
create policy "Auth insert featured"
  on public.featured_games for insert
  to authenticated
  with check (true);

drop policy if exists "Auth update featured" on public.featured_games;
create policy "Auth update featured"
  on public.featured_games for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Auth delete featured" on public.featured_games;
create policy "Auth delete featured"
  on public.featured_games for delete
  to authenticated
  using (true);

drop policy if exists "Auth write settings" on public.hub_settings;
create policy "Auth write settings"
  on public.hub_settings for insert
  to authenticated
  with check (true);

drop policy if exists "Auth update settings" on public.hub_settings;
create policy "Auth update settings"
  on public.hub_settings for update
  to authenticated
  using (true);

-- 3) Storage: keep public read for banners/videos; restrict writes to authenticated
drop policy if exists "Public upload banners" on storage.objects;
drop policy if exists "Public update banners" on storage.objects;
drop policy if exists "Public delete banners" on storage.objects;

drop policy if exists "Auth upload featured media" on storage.objects;
create policy "Auth upload featured media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('featured-banners', 'featured-videos'));

drop policy if exists "Auth update featured media" on storage.objects;
create policy "Auth update featured media"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('featured-banners', 'featured-videos'));

drop policy if exists "Auth delete featured media" on storage.objects;
create policy "Auth delete featured media"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('featured-banners', 'featured-videos'));

-- Public read for media (intentional for visitors)
drop policy if exists "Public read banners" on storage.objects;
create policy "Public read banners"
  on storage.objects for select
  using (bucket_id in ('featured-banners', 'featured-videos'));

-- 4) Remove plaintext admin_password from hub_settings if present
delete from public.hub_settings where key = 'admin_password';

-- NOTE: If a plaintext admin password was previously committed to GitHub
-- or stored in the database, rotate any related credentials. Removing it
-- from the latest code is not sufficient by itself.
