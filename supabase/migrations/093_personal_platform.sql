-- Personal Platform: influences, timeline events, music sessions
-- Surfaces the user's social life + what shapes them on a public profile page.

create table if not exists public.influences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('person','book','track','album','essay','repo','film','artwork','idea','place')),
  title text not null,
  creator text,
  url text,
  note text,
  weight int default 5 check (weight between 1 and 10),
  tags text[] default '{}',
  is_public boolean default true,
  added_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists influences_user_idx on public.influences(user_id, added_at desc);
create index if not exists influences_public_idx on public.influences(is_public, added_at desc) where is_public = true;

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('milestone','note','ship','talk','release','trip','idea','encounter','publication')),
  title text not null,
  body text,
  url text,
  tags text[] default '{}',
  is_public boolean default true,
  occurred_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists timeline_events_user_idx on public.timeline_events(user_id, occurred_at desc);
create index if not exists timeline_events_public_idx on public.timeline_events(is_public, occurred_at desc) where is_public = true;

create table if not exists public.music_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text check (kind in ('session','track','dj_set','preset','remix','sketch','live')),
  duration_min int,
  bpm int,
  musical_key text,
  genre text,
  note text,
  artifact_url text,
  tags text[] default '{}',
  is_public boolean default true,
  occurred_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists music_sessions_user_idx on public.music_sessions(user_id, occurred_at desc);
create index if not exists music_sessions_public_idx on public.music_sessions(is_public, occurred_at desc) where is_public = true;

-- Row Level Security
alter table public.influences enable row level security;
alter table public.timeline_events enable row level security;
alter table public.music_sessions enable row level security;

-- Public influences readable by everyone
create policy "influences_public_read" on public.influences
  for select using (is_public = true);
create policy "influences_owner_all" on public.influences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "timeline_events_public_read" on public.timeline_events
  for select using (is_public = true);
create policy "timeline_events_owner_all" on public.timeline_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "music_sessions_public_read" on public.music_sessions
  for select using (is_public = true);
create policy "music_sessions_owner_all" on public.music_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Unified public feed view: influences + timeline + music as one chronological stream
create or replace view public.personal_feed as
  select
    'influence'::text as item_type,
    id, user_id, added_at as at,
    title, note as body, url,
    kind, tags
  from public.influences where is_public = true
  union all
  select
    'timeline'::text as item_type,
    id, user_id, occurred_at as at,
    title, body, url,
    kind, tags
  from public.timeline_events where is_public = true
  union all
  select
    'music'::text as item_type,
    id, user_id, occurred_at as at,
    title, note as body, artifact_url as url,
    kind, tags
  from public.music_sessions where is_public = true;

-- Allow public read of published social posts (they're already public externally)
-- so profile pages can show a user's cross-platform post stream.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'social_posts' and policyname = 'social_posts_public_read_published'
  ) then
    create policy social_posts_public_read_published on public.social_posts
      for select to anon, authenticated
      using (status = 'published');
  end if;
end $$;

comment on table public.influences is 'Things that shape the user: people, books, tracks, essays, repos, ideas.';
comment on table public.timeline_events is 'Chronological life/work events — ships, milestones, talks, encounters.';
comment on table public.music_sessions is 'DAW/studio work log: sessions, tracks, DJ sets, presets.';
comment on view public.personal_feed is 'Unified chronological stream across influences, timeline, and music for public profile pages.';
