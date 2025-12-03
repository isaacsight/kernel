-- Studio OS Multi-Tenant SaaS Database Schema
-- This schema supports workspaces, teams, subscriptions, and usage tracking

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE USER & ORGANIZATION TABLES
-- ============================================================================

-- Organizations (Customer accounts)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Subscription info
    subscription_tier VARCHAR(50) DEFAULT 'free', -- free, starter, pro, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active', -- active, canceled, past_due, trialing
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    
    -- Stripe info
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255),
    
    -- Settings
    settings JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Auth (managed by Supabase Auth, but we can store additional info)
    auth_provider VARCHAR(50) DEFAULT 'email', -- email, google, github
    
    -- Settings
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Organization Members (many-to-many relationship)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, editor, viewer
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    invited_by UUID REFERENCES users(id),
    
    UNIQUE(organization_id, user_id)
);

-- Workspaces (isolated content environments)
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Settings
    settings JSONB DEFAULT '{}'::jsonb,
    ai_config JSONB DEFAULT '{}'::jsonb, -- AI agent configurations
    
    -- Custom domain support
    custom_domain VARCHAR(255),
    
    UNIQUE(organization_id, slug)
);

-- ============================================================================
-- CONTENT TABLES (workspace-scoped)
-- ============================================================================

-- Posts (scoped to workspace)
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Post metadata
    slug VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    excerpt TEXT,
    
    -- Frontmatter
    category VARCHAR(100),
    tags TEXT[],
    date DATE,
    read_time VARCHAR(50),
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Authoring
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    ai_generated BOOLEAN DEFAULT false,
    ai_provider VARCHAR(50), -- gemini, openai, anthropic
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(workspace_id, slug)
);

-- Post Versions (for revision history)
CREATE TABLE IF NOT EXISTS post_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(post_id, version_number)
);

-- ============================================================================
-- AI USAGE & BILLING TRACKING
-- ============================================================================

-- Usage Logs (for metering AI generations)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Usage details
    usage_type VARCHAR(50) NOT NULL, -- ai_generation, api_call, etc.
    provider VARCHAR(50), -- gemini, openai, anthropic
    model VARCHAR(100),
    
    -- Metrics
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),
    
    -- Context
    resource_type VARCHAR(50), -- post, comment, etc.
    resource_id UUID,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    billing_period VARCHAR(7) -- YYYY-MM format for monthly grouping
);

-- Subscriptions (mirror of Stripe subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Stripe data
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    stripe_price_id VARCHAR(255),
    
    -- Subscription details
    tier VARCHAR(50) NOT NULL, -- starter, pro, enterprise
    status VARCHAR(50) NOT NULL, -- active, canceled, past_due, trialing, incomplete
    
    -- Billing
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices (mirror of Stripe invoices)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- Stripe data
    stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    
    -- Invoice details
    amount_due INTEGER NOT NULL, -- in cents
    amount_paid INTEGER,
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(50), -- draft, open, paid, void, uncollectible
    
    -- Dates
    invoice_pdf TEXT,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- API KEYS & INTEGRATIONS
-- ============================================================================

-- API Keys (user-provided keys for enterprise tier)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Key details
    provider VARCHAR(50) NOT NULL, -- gemini, openai, anthropic
    key_encrypted TEXT NOT NULL, -- Store encrypted
    key_hint VARCHAR(20), -- Last 4 chars for display
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Integrations (GitHub, Substack, etc.)
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Integration details
    integration_type VARCHAR(50) NOT NULL, -- github, substack, medium, wordpress
    config JSONB NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- COLLABORATION & ACTIVITY
-- ============================================================================

-- Comments (for team collaboration on posts)
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Comment content
    content TEXT NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Thread support
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity Log (audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Activity details
    action VARCHAR(100) NOT NULL, -- post_created, member_invited, etc.
    resource_type VARCHAR(50),
    resource_id UUID,
    
    -- Context
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_stripe_customer ON organizations(stripe_customer_id);

-- Users
CREATE INDEX idx_users_email ON users(email);

-- Organization Members
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- Workspaces
CREATE INDEX idx_workspaces_org ON workspaces(organization_id);
CREATE INDEX idx_workspaces_slug ON workspaces(organization_id, slug);

-- Posts
CREATE INDEX idx_posts_workspace ON posts(workspace_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_by ON posts(created_by);
CREATE INDEX idx_posts_slug ON posts(workspace_id, slug);

-- Usage Logs
CREATE INDEX idx_usage_org ON usage_logs(organization_id);
CREATE INDEX idx_usage_billing_period ON usage_logs(organization_id, billing_period);
CREATE INDEX idx_usage_created_at ON usage_logs(created_at);

-- Activity Log
CREATE INDEX idx_activity_org ON activity_log(organization_id);
CREATE INDEX idx_activity_workspace ON activity_log(workspace_id);
CREATE INDEX idx_activity_created_at ON activity_log(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is member of organization
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = org_id AND organization_members.user_id = user_id
    );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Organizations: Users can only see orgs they're members of
CREATE POLICY org_member_access ON organizations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = organizations.id
            AND organization_members.user_id = auth.uid()
        )
    );

-- Workspaces: Users can only access workspaces in their organizations
CREATE POLICY workspace_org_access ON workspaces
    FOR ALL
    USING (
        is_org_member(organization_id, auth.uid())
    );

-- Posts: Users can only access posts in workspaces they have access to
CREATE POLICY post_workspace_access ON posts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = posts.workspace_id
            AND is_org_member(w.organization_id, auth.uid())
        )
    );

-- Similar policies for other tables...

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS FOR USAGE TRACKING
-- ============================================================================

-- Get current period usage for an organization
CREATE OR REPLACE FUNCTION get_current_period_usage(org_id UUID)
RETURNS TABLE(usage_type VARCHAR, count BIGINT, tokens BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ul.usage_type,
        COUNT(*)::BIGINT as count,
        SUM(ul.tokens_used)::BIGINT as tokens
    FROM usage_logs ul
    WHERE ul.organization_id = org_id
    AND ul.billing_period = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    GROUP BY ul.usage_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get usage limit for organization based on tier
CREATE OR REPLACE FUNCTION get_usage_limit(tier VARCHAR)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE tier
        WHEN 'free' THEN 10
        WHEN 'starter' THEN 100
        WHEN 'pro' THEN 500
        WHEN 'enterprise' THEN 2000
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if organization has exceeded usage limit
CREATE OR REPLACE FUNCTION check_usage_limit(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_usage INTEGER;
    usage_limit INTEGER;
    org_tier VARCHAR;
BEGIN
    SELECT subscription_tier INTO org_tier
    FROM organizations WHERE id = org_id;
    
    SELECT COUNT(*) INTO current_usage
    FROM usage_logs
    WHERE organization_id = org_id
    AND billing_period = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    AND usage_type = 'ai_generation';
    
    usage_limit := get_usage_limit(org_tier);
    
    RETURN current_usage < usage_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
