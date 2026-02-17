-- ═══════════════════════════════════════════════════════════
-- Procedural Memory — Learned & Defined Workflows
-- ═══════════════════════════════════════════════════════════
-- Stores repeating multi-step patterns that Kernel learns
-- from user behavior or that users explicitly define.

create table if not exists procedures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  trigger_phrase text not null,
  steps jsonb not null,  -- Array of { description, agentId, toolName?, args? }
  times_executed int default 0,
  last_executed_at timestamptz,
  created_at timestamptz default now(),
  source text default 'learned'  -- learned (auto-detected) or defined (user-created)
);

-- Indexes
create index if not exists idx_procedures_user on procedures(user_id);
create index if not exists idx_procedures_trigger on procedures(user_id, trigger_phrase);

-- RLS
alter table procedures enable row level security;

create policy "Users can read own procedures"
  on procedures for select
  using (auth.uid() = user_id);

create policy "Users can insert own procedures"
  on procedures for insert
  with check (auth.uid() = user_id);

create policy "Users can update own procedures"
  on procedures for update
  using (auth.uid() = user_id);

create policy "Users can delete own procedures"
  on procedures for delete
  using (auth.uid() = user_id);
