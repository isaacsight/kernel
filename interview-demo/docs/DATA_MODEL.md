# Data Model

Postgres schema for Setlist. Every table has RLS enabled. Every mutating
route validates ownership server-side too — RLS is defense in depth, not
the only check.

## Entity map

```
users (managed by Supabase Auth)
  │
  ├──< tracks >── playlist_tracks >── playlists
  │                                        │
  ├──< generations (one per /generate call)│
  │                                        │
  └──< shares (public links, token-gated) ─┘
```

## Tables

### `profiles`

Extends `auth.users` with app-specific fields. Row created via trigger on
`auth.users` insert.

```sql
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        citext unique not null,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  -- soft quotas, checked in edge API
  monthly_generations_used  int not null default 0,
  monthly_generations_reset date not null default date_trunc('month', now())
);

alter table profiles enable row level security;

-- owner can read/update own row
create policy "profiles_self_read" on profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on profiles
  for update using (auth.uid() = id);

-- public profile fields readable to all
create policy "profiles_public_read" on profiles
  for select using (true);  -- handle, display_name, avatar_url are all public
```

### `tracks`

One row per completed generation the user kept. Separate from `generations`
because a user may generate 5 variants and keep 1.

```sql
create table tracks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  title         text not null,
  prompt        text not null,
  style_tags    text[] not null default '{}',
  duration_sec  int not null check (duration_sec between 5 and 300),
  bpm           int,
  key_sig       text,                -- e.g. "A min"
  audio_url     text not null,       -- R2 signed or public
  peaks_url     text not null,       -- JSON peaks for WaveSurfer
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  generation_id uuid references generations(id)
);

create index tracks_owner_created_idx on tracks(owner_id, created_at desc);
create index tracks_public_idx on tracks(is_public) where is_public = true;

alter table tracks enable row level security;

create policy "tracks_owner_all" on tracks
  for all using (auth.uid() = owner_id);
create policy "tracks_public_read" on tracks
  for select using (is_public = true);
```

### `generations`

Every `/generate` call creates one row. Kept even on failure for debugging
and rate-limit accounting.

```sql
create type generation_status as enum (
  'queued', 'generating', 'complete', 'failed', 'cancelled'
);

create table generations (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  prompt        text not null,
  style_tags    text[] not null default '{}',
  duration_sec  int not null,
  status        generation_status not null default 'queued',
  suno_job_id   text,
  progress_pct  int not null default 0 check (progress_pct between 0 and 100),
  error_message text,
  track_id      uuid references tracks(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index generations_owner_idx on generations(owner_id, created_at desc);
create index generations_suno_job_idx on generations(suno_job_id)
  where suno_job_id is not null;
create index generations_status_idx on generations(status)
  where status in ('queued', 'generating');

alter table generations enable row level security;
create policy "generations_owner_all" on generations
  for all using (auth.uid() = owner_id);
```

### `playlists`

```sql
create table playlists (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  title         text not null,
  description   text,
  cover_url     text,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index playlists_owner_idx on playlists(owner_id, updated_at desc);

alter table playlists enable row level security;
create policy "playlists_owner_all" on playlists
  for all using (auth.uid() = owner_id);
create policy "playlists_public_read" on playlists
  for select using (is_public = true);
```

### `playlist_tracks`

Join table, ordered. Using `position` (float) not `order` (int) so we can
insert between two rows without renumbering — classic Jira/Linear trick.

```sql
create table playlist_tracks (
  playlist_id   uuid not null references playlists(id) on delete cascade,
  track_id      uuid not null references tracks(id) on delete cascade,
  position      double precision not null,
  added_at      timestamptz not null default now(),
  added_by      uuid not null references profiles(id),
  primary key (playlist_id, track_id)
);

create index playlist_tracks_order_idx on playlist_tracks(playlist_id, position);

alter table playlist_tracks enable row level security;
create policy "playlist_tracks_via_playlist" on playlist_tracks
  for all using (
    exists (
      select 1 from playlists p
      where p.id = playlist_id and p.owner_id = auth.uid()
    )
  );
create policy "playlist_tracks_public_read" on playlist_tracks
  for select using (
    exists (select 1 from playlists p where p.id = playlist_id and p.is_public)
  );
```

### `shares`

Tokenized public links. One playlist can have multiple active share tokens
(per channel — Discord share, Twitter share, etc). Tokens expire.

```sql
create table shares (
  id            uuid primary key default gen_random_uuid(),
  playlist_id   uuid not null references playlists(id) on delete cascade,
  token         text not null unique,  -- 22-char URL-safe random
  created_by    uuid not null references profiles(id),
  label         text,                   -- human-readable ("discord", "twitter")
  expires_at    timestamptz,            -- null = never
  revoked_at    timestamptz,
  view_count    int not null default 0,
  created_at    timestamptz not null default now()
);

create unique index shares_token_idx on shares(token)
  where revoked_at is null;

alter table shares enable row level security;
-- owner of the playlist manages shares
create policy "shares_owner_all" on shares
  for all using (
    exists (
      select 1 from playlists p
      where p.id = playlist_id and p.owner_id = auth.uid()
    )
  );
-- anon read of active tokens handled in edge API, not RLS
-- (we don't want to leak existence by token enumeration)
```

## Triggers

### Create profile on signup

```sql
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    'user_' || substr(md5(new.id::text), 1, 8),
    coalesce(new.raw_user_meta_data->>'name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Notify on generation status change

```sql
create function notify_generation_update()
returns trigger as $$
begin
  if old.status is distinct from new.status
     or old.progress_pct is distinct from new.progress_pct then
    perform pg_notify(
      'generation_update',
      json_build_object(
        'id', new.id,
        'owner_id', new.owner_id,
        'status', new.status,
        'progress_pct', new.progress_pct,
        'track_id', new.track_id
      )::text
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger generations_notify
  after update on generations
  for each row execute procedure notify_generation_update();
```

### Touch `updated_at`

Applied to `tracks`, `playlists`, `generations`:

```sql
create function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
```

## Views

### `public_playlist_view`

Denormalized read for share-link consumers (no auth needed):

```sql
create view public_playlist_view as
select
  p.id, p.title, p.description, p.cover_url,
  pr.handle as owner_handle, pr.display_name as owner_name,
  (select count(*) from playlist_tracks pt where pt.playlist_id = p.id) as track_count,
  p.updated_at
from playlists p
join profiles pr on pr.id = p.owner_id
where p.is_public = true;
```

## Migrations

All migrations in `supabase/migrations/` with timestamp prefix. Never edit
a shipped migration — always add a new one. Supabase CLI generates them:

```bash
pnpm supabase db diff -f add_shares_table
```

## Seed data

`supabase/seed.sql` creates a demo user with 3 playlists and 12 tracks so
`pnpm dev` has something interesting on first launch. Seed is NEVER run
in production.
