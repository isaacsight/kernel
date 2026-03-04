-- ═══════════════════════════════════════════════════════════════
--  056 — Project Files: Server-side artifact persistence for Pro
-- ═══════════════════════════════════════════════════════════════

-- ─── Table ──────────────────────────────────────────

create table if not exists project_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text not null,
  filename text not null,
  language text not null default 'text',
  storage_path text not null,
  size_bytes integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, conversation_id, filename)
);

create index if not exists idx_project_files_user on project_files(user_id);
create index if not exists idx_project_files_conversation on project_files(user_id, conversation_id);

alter table project_files enable row level security;

-- ─── RLS ────────────────────────────────────────────

-- Users can read their own files
create policy "Users can read their own project files"
  on project_files for select
  using (auth.uid() = user_id);

-- Only service role (edge functions) can write
-- No INSERT/UPDATE/DELETE policies for authenticated — all writes go through edge function

-- ─── Storage Bucket ─────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do nothing;

-- Storage RLS: users can read their own files (path starts with their user_id)
create policy "Users can read their own project files"
  on storage.objects for select
  using (bucket_id = 'project-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only service role can write to storage (edge functions use service role key)
