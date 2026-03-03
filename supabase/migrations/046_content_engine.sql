-- ─── 046: Content Engine + Algorithm Engine ─────────────────────
--
-- Tables for the multi-stage content pipeline and
-- content intelligence / algorithm scoring system.

-- ─── Content Items ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief         text NOT NULL,
  format        text NOT NULL DEFAULT 'blog_post',
  title         text,
  tags          text[] DEFAULT '{}',
  current_stage text NOT NULL DEFAULT 'ideation',
  stages        jsonb NOT NULL DEFAULT '[]',
  final_content text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_items_user ON content_items(user_id);
CREATE INDEX idx_content_items_stage ON content_items(current_stage);

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_items_select ON content_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY content_items_insert ON content_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY content_items_update ON content_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY content_items_delete ON content_items FOR DELETE USING (auth.uid() = user_id);

-- ─── Content Versions (immutable snapshots at each stage) ──────

CREATE TABLE IF NOT EXISTS content_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  stage       text NOT NULL,
  content     text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_versions_content ON content_versions(content_id);

ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_versions_select ON content_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));
CREATE POLICY content_versions_insert ON content_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));

-- ─── Algorithm Scores ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS algorithm_scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  composite   real NOT NULL DEFAULT 0,
  dimensions  jsonb NOT NULL DEFAULT '[]',
  scored_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_algorithm_scores_content ON algorithm_scores(content_id);

ALTER TABLE algorithm_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY algorithm_scores_select ON algorithm_scores FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));
CREATE POLICY algorithm_scores_insert ON algorithm_scores FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));

-- ─── Algorithm Weights (per-user learned preferences) ──────────

CREATE TABLE IF NOT EXISTS algorithm_weights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  weights       jsonb NOT NULL DEFAULT '{"relevance":0.30,"quality":0.25,"userAffinity":0.20,"freshness":0.15,"trendAlignment":0.10}',
  learning_rate real NOT NULL DEFAULT 0.1,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_algorithm_weights_user ON algorithm_weights(user_id);

ALTER TABLE algorithm_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY algorithm_weights_select ON algorithm_weights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY algorithm_weights_insert ON algorithm_weights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY algorithm_weights_update ON algorithm_weights FOR UPDATE USING (auth.uid() = user_id);

-- ─── Content Performance ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS content_performance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  platform    text NOT NULL,
  metric      text NOT NULL,
  value       real NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_performance_content ON content_performance(content_id);

ALTER TABLE content_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_performance_select ON content_performance FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));
CREATE POLICY content_performance_insert ON content_performance FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));
CREATE POLICY content_performance_update ON content_performance FOR UPDATE
  USING (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));

-- ─── Algorithm Feedback (weight learning history) ──────────────

CREATE TABLE IF NOT EXISTS algorithm_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id          uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  predicted_score     real NOT NULL,
  actual_performance  real NOT NULL,
  weight_delta        jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_algorithm_feedback_content ON algorithm_feedback(content_id);

ALTER TABLE algorithm_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY algorithm_feedback_select ON algorithm_feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));
CREATE POLICY algorithm_feedback_insert ON algorithm_feedback FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = content_id AND ci.user_id = auth.uid()));
