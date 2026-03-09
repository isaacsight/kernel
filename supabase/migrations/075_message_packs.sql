-- Migration 075: Message Packs
-- Switch from subscriptions to prepaid message packs.
-- Users buy message credits, claude-proxy deducts from balance.

-- Add message_balance to user_memory (the main user state table)
ALTER TABLE user_memory
ADD COLUMN IF NOT EXISTS message_balance integer NOT NULL DEFAULT 0;

-- Track purchase history
CREATE TABLE IF NOT EXISTS message_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text,
  stripe_payment_intent text,
  pack_size integer NOT NULL,        -- 100, 500, 2000
  amount_cents integer NOT NULL,     -- 1500, 5000, 15000
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for user purchase history
CREATE INDEX IF NOT EXISTS idx_message_purchases_user
ON message_purchases(user_id, created_at DESC);

-- RLS on message_purchases
ALTER TABLE message_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
ON message_purchases FOR SELECT
USING (auth.uid() = user_id);

-- RPC: deduct a message from balance (called by claude-proxy)
-- Returns the new balance. Returns -1 if insufficient.
CREATE OR REPLACE FUNCTION deduct_message(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE user_memory
  SET message_balance = message_balance - 1
  WHERE user_id = p_user_id
    AND message_balance > 0
  RETURNING message_balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_balance;
END;
$$;

-- RPC: add messages to balance (called by stripe-webhook after purchase)
CREATE OR REPLACE FUNCTION add_message_credits(
  p_user_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  -- Ensure user_memory row exists
  INSERT INTO user_memory (user_id, message_balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_memory
  SET message_balance = message_balance + p_amount
  WHERE user_id = p_user_id
  RETURNING message_balance INTO new_balance;

  RETURN COALESCE(new_balance, 0);
END;
$$;

-- RPC: get current balance (for frontend display)
CREATE OR REPLACE FUNCTION get_message_balance(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bal integer;
BEGIN
  SELECT message_balance INTO bal
  FROM user_memory
  WHERE user_id = p_user_id;

  RETURN COALESCE(bal, 0);
END;
$$;

-- Revoke direct access to RPCs from public
REVOKE EXECUTE ON FUNCTION deduct_message FROM public, anon;
REVOKE EXECUTE ON FUNCTION add_message_credits FROM public, anon;
-- Allow authenticated users to check their own balance
GRANT EXECUTE ON FUNCTION get_message_balance TO authenticated;
