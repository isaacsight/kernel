-- ═══════════════════════════════════════════════════════════
-- Knowledge Graph Memory — Entities & Relations
-- ═══════════════════════════════════════════════════════════
-- Stores structured knowledge extracted from conversations:
-- entities (people, companies, projects, concepts) and
-- relations between them (works_at, uses, prefers, etc.)

-- Entities: people, companies, projects, concepts, preferences, locations
create table if not exists knowledge_graph_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  entity_type text not null,  -- person, company, project, concept, preference, location
  properties jsonb default '{}',
  confidence float default 0.5,
  source text default 'inferred',  -- inferred, stated, observed
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  mention_count int default 1
);

-- Relations: connects two entities
create table if not exists knowledge_graph_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  source_id uuid references knowledge_graph_entities(id) on delete cascade not null,
  target_id uuid references knowledge_graph_entities(id) on delete cascade not null,
  relation_type text not null,  -- works_at, uses, prefers, knows, owns, related_to
  properties jsonb default '{}',
  confidence float default 0.5,
  created_at timestamptz default now()
);

-- Indexes for fast lookups
create index if not exists idx_kg_entities_user on knowledge_graph_entities(user_id);
create index if not exists idx_kg_entities_type on knowledge_graph_entities(user_id, entity_type);
create index if not exists idx_kg_entities_name on knowledge_graph_entities(user_id, name);
create index if not exists idx_kg_relations_user on knowledge_graph_relations(user_id);
create index if not exists idx_kg_relations_source on knowledge_graph_relations(source_id);
create index if not exists idx_kg_relations_target on knowledge_graph_relations(target_id);
create index if not exists idx_kg_relations_type on knowledge_graph_relations(user_id, relation_type);

-- RLS: users can only see their own graph
alter table knowledge_graph_entities enable row level security;
alter table knowledge_graph_relations enable row level security;

create policy "Users can read own entities"
  on knowledge_graph_entities for select
  using (auth.uid() = user_id);

create policy "Users can insert own entities"
  on knowledge_graph_entities for insert
  with check (auth.uid() = user_id);

create policy "Users can update own entities"
  on knowledge_graph_entities for update
  using (auth.uid() = user_id);

create policy "Users can delete own entities"
  on knowledge_graph_entities for delete
  using (auth.uid() = user_id);

create policy "Users can read own relations"
  on knowledge_graph_relations for select
  using (auth.uid() = user_id);

create policy "Users can insert own relations"
  on knowledge_graph_relations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own relations"
  on knowledge_graph_relations for update
  using (auth.uid() = user_id);

create policy "Users can delete own relations"
  on knowledge_graph_relations for delete
  using (auth.uid() = user_id);
