# TikTok Clone

A mobile-first TikTok-style web app with authentication and data stored in Supabase.

## Live
Open: https://victorxd21.github.io/hello21.github.io/games/TikTok/

## Features
- Sign up / Log in (Supabase Auth)
- For You video feed (swipe up/down)
- Like videos
- Create & post videos (URL)
- Inbox mock
- Profile page with stats & your videos
- Bottom navigation matching TikTok

## Supabase Setup (required for full functionality)

Go to your Supabase project dashboard → SQL Editor and run:

```sql
-- Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  avatar_url text,
  bio text default 'New to TikTok',
  following int default 0,
  followers int default 0,
  likes int default 0,
  created_at timestamptz default now()
);

-- Videos table
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

-- Enable RLS
alter table profiles enable row level security;
alter table videos enable row level security;

-- Policies (open for demo – tighten later)
create policy "Public profiles" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Public videos" on videos for select using (true);
create policy "Users can insert own videos" on videos for insert with check (auth.uid() = user_id);
create policy "Users can update own videos" on videos for update using (auth.uid() = user_id);
```

Also enable **Email** auth provider in Authentication → Providers.

If you leave tables empty the app falls back to sample videos so it still works.

## Notes
- Uses your provided Supabase URL + publishable key.
- Does not copy any private chats or personal profile data from the screenshots.
- Pure static site – works on GitHub Pages.
