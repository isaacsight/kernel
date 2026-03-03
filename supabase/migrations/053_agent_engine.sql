-- ═══════════════════════════════════════════════════════════════
-- 053: Agent Engine — Custom Agent Builder
-- ═══════════════════════════════════════════════════════════════
-- Custom agents, installs, conversations, workflows, and runs.

-- ─── Custom Agents ──────────────────────────────────────────
create table if not exists custom_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  persona text not null,
  tools jsonb not null default '[]'::jsonb,
  knowledge_ids jsonb not null default '[]'::jsonb,
  starters jsonb not null default '[]'::jsonb,
  icon text not null default '🤖',
  color text not null default '#6B5B95',
  is_public boolean not null default false,
  install_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_custom_agents_user on custom_agents(user_id);
create index if not exists idx_custom_agents_public on custom_agents(is_public) where is_public = true;

alter table custom_agents enable row level security;

create policy "Users can manage their own agents"
  on custom_agents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Anyone can read public agents"
  on custom_agents for select
  using (is_public = true);

-- ─── Agent Installs ─────────────────────────────────────────
create table if not exists agent_installs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references custom_agents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  installed_at timestamptz not null default now(),
  unique(agent_id, user_id)
);

create index if not exists idx_agent_installs_user on agent_installs(user_id);
create index if not exists idx_agent_installs_agent on agent_installs(agent_id);

alter table agent_installs enable row level security;

create policy "Users can manage their own installs"
  on agent_installs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Agent Conversations ────────────────────────────────────
create table if not exists agent_conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references custom_agents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_conversations_agent_user on agent_conversations(agent_id, user_id);

alter table agent_conversations enable row level security;

create policy "Users can manage their own agent conversations"
  on agent_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Agent Workflows ────────────────────────────────────────
create table if not exists agent_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_workflows_user on agent_workflows(user_id);

alter table agent_workflows enable row level security;

create policy "Users can manage their own workflows"
  on agent_workflows for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Agent Workflow Runs ────────────────────────────────────
create table if not exists agent_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references agent_workflows(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  step_results jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_agent_workflow_runs_workflow on agent_workflow_runs(workflow_id);

alter table agent_workflow_runs enable row level security;

create policy "Users can manage their own workflow runs"
  on agent_workflow_runs for all
  using (
    exists (
      select 1 from agent_workflows w
      where w.id = agent_workflow_runs.workflow_id
      and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from agent_workflows w
      where w.id = agent_workflow_runs.workflow_id
      and w.user_id = auth.uid()
    )
  );
