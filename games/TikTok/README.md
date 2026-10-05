# TikTok Clone – Extra SQL needed

Run this in Supabase SQL Editor if you haven't already:

```sql
-- Add name + avatar to profiles (safe if columns already exist)
alter table profiles add column if not exists name text;
alter table profiles add column if not exists avatar_url text;

-- Toggle likes
create table if not exists video_likes (
  user_id uuid references profiles(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,
  primary key (user_id, video_id)
);
alter table video_likes enable row level security;
create policy "likes select" on video_likes for select using (true);
create policy "likes insert" on video_likes for insert with check (auth.uid() = user_id);
create policy "likes delete" on video_likes for delete using (auth.uid() = user_id);

-- Toggle bookmarks
create table if not exists video_bookmarks (
  user_id uuid references profiles(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,
  primary key (user_id, video_id)
);
alter table video_bookmarks enable row level security;
create policy "bm select" on video_bookmarks for select using (true);
create policy "bm insert" on video_bookmarks for insert with check (auth.uid() = user_id);
create policy "bm delete" on video_bookmarks for delete using (auth.uid() = user_id);

-- Follows
create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  primary key (follower_id, following_id)
);
alter table follows enable row level security;
create policy "follows select" on follows for select using (true);
create policy "follows insert" on follows for insert with check (auth.uid() = follower_id);
create policy "follows delete" on follows for delete using (auth.uid() = follower_id);

-- Comments parent_id for replies
alter table comments add column if not exists parent_id uuid;
```
