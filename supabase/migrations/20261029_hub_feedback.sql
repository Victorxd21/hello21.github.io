-- Public reports and game requests are inserted only by the hub-feedback Edge Function.
-- Protect existing admin-managed tables and media with the fixed Auth identity too.
create table if not exists public.featured_games (
  id uuid primary key default gen_random_uuid(),
  folder text not null unique,
  name text not null,
  file text default 'index.html',
  icon text default '🎮',
  images text[] not null default '{}',
  video_url text default null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.featured_games add column if not exists video_url text;
alter table public.featured_games enable row level security;
grant select on public.featured_games to anon, authenticated;
grant insert, update, delete on public.featured_games to authenticated;
drop policy if exists "Public insert featured" on public.featured_games;
drop policy if exists "Public update featured" on public.featured_games;
drop policy if exists "Public delete featured" on public.featured_games;
drop policy if exists "Public read featured" on public.featured_games;
create policy "Public read featured" on public.featured_games for select using (true);

create table if not exists public.hub_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.hub_settings enable row level security;
grant select on public.hub_settings to anon, authenticated;
grant insert, update on public.hub_settings to authenticated;
drop policy if exists "Public write settings" on public.hub_settings;
drop policy if exists "Public update settings" on public.hub_settings;
drop policy if exists "Public insert settings" on public.hub_settings;
drop policy if exists "Public read settings" on public.hub_settings;
create policy "Public read settings" on public.hub_settings for select using (true);
delete from public.hub_settings where key = 'admin_password';

insert into storage.buckets (id, name, public)
  values ('featured-banners', 'featured-banners', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public)
  values ('featured-videos', 'featured-videos', true)
  on conflict (id) do update set public = true;
drop policy if exists "Public upload banners" on storage.objects;
drop policy if exists "Public update banners" on storage.objects;
drop policy if exists "Public delete banners" on storage.objects;
drop policy if exists "Public read banners" on storage.objects;
create policy "Public read banners" on storage.objects for select
  using (bucket_id in ('featured-banners', 'featured-videos'));

drop policy if exists "Auth insert featured" on public.featured_games;
create policy "Auth insert featured"
  on public.featured_games for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid');

drop policy if exists "Auth update featured" on public.featured_games;
create policy "Auth update featured"
  on public.featured_games for update to authenticated
  using ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid')
  with check ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid');

drop policy if exists "Auth delete featured" on public.featured_games;
create policy "Auth delete featured"
  on public.featured_games for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid');

drop policy if exists "Auth write settings" on public.hub_settings;
create policy "Auth write settings"
  on public.hub_settings for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid');

drop policy if exists "Auth update settings" on public.hub_settings;
create policy "Auth update settings"
  on public.hub_settings for update to authenticated
  using ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid')
  with check ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid');

drop policy if exists "Auth upload featured media" on storage.objects;
create policy "Auth upload featured media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('featured-banners', 'featured-videos')
    and (auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid'
  );

drop policy if exists "Auth update featured media" on storage.objects;
create policy "Auth update featured media"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('featured-banners', 'featured-videos')
    and (auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid'
  )
  with check (
    bucket_id in ('featured-banners', 'featured-videos')
    and (auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid'
  );

drop policy if exists "Auth delete featured media" on storage.objects;
create policy "Auth delete featured media"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('featured-banners', 'featured-videos')
    and (auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid'
  );

create table if not exists public.hub_feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('problem', 'request')),
  game_name text not null default '' check (char_length(game_name) <= 120),
  message text not null check (char_length(message) between 8 and 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.hub_feedback enable row level security;
revoke all on public.hub_feedback from anon, authenticated;
grant insert on public.hub_feedback to service_role;
grant select on public.hub_feedback to authenticated;
grant update (status) on public.hub_feedback to authenticated;

drop policy if exists "Authenticated admins read hub feedback" on public.hub_feedback;
create policy "Authenticated admins read hub feedback"
  on public.hub_feedback for select to authenticated
  using ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid');

drop policy if exists "Authenticated admins update hub feedback" on public.hub_feedback;
create policy "Authenticated admins update hub feedback"
  on public.hub_feedback for update to authenticated
  using ((auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid')
  with check (
    (auth.jwt() ->> 'email') = 'hub-admin@gamehub.invalid'
    and status in ('new', 'reviewing', 'resolved')
  );

create table if not exists public.hub_feedback_rate_limits (
  rate_key text primary key,
  last_request_at timestamptz not null default now()
);
alter table public.hub_feedback_rate_limits enable row level security;
revoke all on public.hub_feedback_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.hub_feedback_rate_limits to service_role;

create or replace function public.consume_hub_feedback_rate_limit(
  p_rate_key text,
  p_cooldown_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  insert into public.hub_feedback_rate_limits (rate_key, last_request_at)
  values (p_rate_key, now())
  on conflict (rate_key) do update
    set last_request_at = excluded.last_request_at
    where public.hub_feedback_rate_limits.last_request_at
      <= now() - make_interval(secs => greatest(1, least(p_cooldown_seconds, 3600)));

  get diagnostics affected_rows = row_count;
  delete from public.hub_feedback_rate_limits
    where last_request_at < now() - interval '2 days';
  return affected_rows > 0;
end;
$$;

revoke all on function public.consume_hub_feedback_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_hub_feedback_rate_limit(text, integer) to service_role;

-- Create the Auth user in Supabase Dashboard with email hub-admin@gamehub.invalid,
-- mark it confirmed, and set its password there. Supabase Auth stores only a secure hash.