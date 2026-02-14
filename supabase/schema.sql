-- Inquiries table — stores all project inquiry leads
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

create table if not exists inquiries (
  id text primary key,
  name text,
  email text not null,
  details text,
  description text,
  evaluation_score integer,
  evaluation_tier text,
  quote_total numeric,
  quote_type text,
  quote_complexity text,
  stripe_payment_link text,
  status text default 'new' check (status in ('new', 'contacted', 'paid', 'in_progress', 'completed')),
  created_at timestamptz default now()
);

-- Enable Row Level Security (required for Supabase)
alter table inquiries enable row level security;

-- Allow anonymous inserts (so the frontend can submit without auth)
create policy "Allow anonymous inserts" on inquiries
  for insert
  with check (true);

-- Allow anonymous reads (for your dashboard — tighten this later with auth)
create policy "Allow anonymous reads" on inquiries
  for select
  using (true);

-- Allow anonymous updates (for status changes — tighten later)
create policy "Allow anonymous updates" on inquiries
  for update
  using (true);

-- Index for fast lookups
create index if not exists idx_inquiries_status on inquiries (status);
create index if not exists idx_inquiries_created on inquiries (created_at desc);


-- ────────────────────────────────────────────────────────────
-- Evaluation conversations — stores full chat history for learning
-- ────────────────────────────────────────────────────────────

create table if not exists evaluation_conversations (
  id text primary key,
  email text,
  messages jsonb not null,
  evaluation_result jsonb,
  project_type text,
  tier text,
  score integer,
  converted boolean default false,
  created_at timestamptz default now()
);

alter table evaluation_conversations enable row level security;

create policy "Allow anonymous inserts on eval_conversations" on evaluation_conversations
  for insert with check (true);

create policy "Allow anonymous reads on eval_conversations" on evaluation_conversations
  for select using (true);

create index if not exists idx_eval_conversations_email on evaluation_conversations (email);
create index if not exists idx_eval_conversations_created on evaluation_conversations (created_at desc);


-- ────────────────────────────────────────────────────────────
-- Agent insights — learned patterns that enrich future conversations
-- ────────────────────────────────────────────────────────────

create table if not exists agent_insights (
  id text primary key,
  insight text not null,
  category text,
  source_conversation_id text references evaluation_conversations(id),
  times_used integer default 0,
  created_at timestamptz default now()
);

alter table agent_insights enable row level security;

create policy "Allow anonymous inserts on agent_insights" on agent_insights
  for insert with check (true);

create policy "Allow anonymous reads on agent_insights" on agent_insights
  for select using (true);

create policy "Allow anonymous updates on agent_insights" on agent_insights
  for update using (true);

create index if not exists idx_agent_insights_created on agent_insights (created_at desc);
create index if not exists idx_agent_insights_category on agent_insights (category);


-- ────────────────────────────────────────────────────────────
-- Seed insights — so the agent isn't cold on day one
-- ────────────────────────────────────────────────────────────

insert into agent_insights (id, insight, category) values
  ('seed_01', 'Marketplace projects with AI-as-a-service models consistently underestimate verification complexity. Push hard on how they will validate agent output quality at scale.', 'technical_pattern'),
  ('seed_02', 'Solo founders building SaaS with under 3 months of runway rarely account for go-to-market time. The product gets built but nobody finds out about it.', 'founder_behavior'),
  ('seed_03', 'Projects scoring high on innovation but low on market demand often have a positioning problem, not a product problem. Reframing the pitch usually matters more than changing the feature set.', 'market_signal'),
  ('seed_04', 'Two-sided marketplaces almost always underestimate the cold-start problem. Ask which side they plan to subsidize and for how long.', 'risk_factor'),
  ('seed_05', 'Consumer social apps with no clear monetization path within the first 6 months rarely survive. Ad revenue requires scale that most indie teams cannot reach.', 'pricing_insight'),
  ('seed_06', 'Projects that depend on a single API provider (OpenAI, Stripe, etc.) carry platform risk. If the provider changes pricing or terms, the entire margin structure collapses.', 'risk_factor'),
  ('seed_07', 'Founders who describe their competitive advantage as "better UX" without specifics are usually describing a feature gap, not a moat. Push on what makes switching costs real.', 'founder_behavior')
on conflict (id) do nothing;
