# TikTok Clone – Setup

## Required Supabase setup (run in SQL Editor)

```sql
-- Profiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  bio text default '',
  following int default 0,
  followers int default 0,
  likes int default 0,
  created_at timestamptz default now()
);

-- Videos
create table if not exists videos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  caption text,
  video_url text,
  likes int default 0,
  comments int default 0,
  bookmarks int default 0,
  shares int default 0,
  created_at timestamptz default now()
);

-- Comments
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references videos(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table videos enable row level security;
alter table comments enable row level security;

-- Open policies for demo
drop policy if exists "Public profiles" on profiles;
create policy "Public profiles" on profiles for select using (true);
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile" on profiles for insert with check (true);

drop policy if exists "Public videos" on videos;
create policy "Public videos" on videos for select using (true);
drop policy if exists "Users can insert own videos" on videos;
create policy "Users can insert own videos" on videos for insert with check (auth.uid() = user_id);
drop policy if exists "Anyone can update videos" on videos;
create policy "Anyone can update videos" on videos for update using (true);

drop policy if exists "Public comments" on comments;
create policy "Public comments" on comments for select using (true);
drop policy if exists "Users can insert comments" on comments;
create policy "Users can insert comments" on comments for insert with check (auth.uid() = user_id);
```

## Storage bucket (required for video upload)

1. Go to **Storage** in Supabase
2. Create a new bucket named **`videos`**
3. Make it **Public**
4. Under Policies for the bucket, add:

```sql
-- Allow authenticated users to upload
create policy "Auth users can upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'videos');

-- Allow public read
create policy "Public read"
on storage.objects for select
to public
using (bucket_id = 'videos');
```

Also disable **Confirm email** under Authentication → Sign In / Providers → Email while testing.

## Live
https://victorxd21.github.io/hello21.github.io/games/TikTok/
