-- Migration 035: Multimodal Limits
-- Tracking daily image uploads per user
ALTER TABLE user_memory
ADD COLUMN IF NOT EXISTS daily_image_count INT DEFAULT 0;
CREATE OR REPLACE FUNCTION protect_image_count() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF current_setting('app.allow_image_count_update', true) IS DISTINCT
FROM 'true' THEN IF NEW.daily_image_count IS DISTINCT
FROM OLD.daily_image_count THEN RAISE EXCEPTION 'Direct modification of daily_image_count is not allowed. Use increment_image_count() instead.';
END IF;
END IF;
RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_image_count_trigger ON user_memory;
CREATE TRIGGER protect_image_count_trigger BEFORE
UPDATE ON user_memory FOR EACH ROW EXECUTE FUNCTION protect_image_count();
CREATE OR REPLACE FUNCTION check_image_limit(p_user_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_daily INT;
v_window TIMESTAMPTZ;
v_now TIMESTAMPTZ := now();
BEGIN
SELECT daily_image_count,
    daily_window_start INTO v_daily,
    v_window
FROM user_memory
WHERE user_id = p_user_id;
-- No row yet = first time
IF NOT FOUND THEN RETURN jsonb_build_object(
    'allowed',
    true,
    'daily_count',
    0,
    'resets_at',
    null
);
END IF;
-- Window expired or null = new window
IF v_window IS NULL
OR v_now >= v_window + interval '24 hours' THEN RETURN jsonb_build_object(
    'allowed',
    true,
    'daily_count',
    0,
    'resets_at',
    null
);
END IF;
RETURN jsonb_build_object(
    'allowed',
    true,
    'daily_count',
    v_daily,
    'resets_at',
    (v_window + interval '24 hours')::text
);
END;
$$;
REVOKE ALL ON FUNCTION check_image_limit(UUID)
FROM PUBLIC;
REVOKE ALL ON FUNCTION check_image_limit(UUID)
FROM authenticated;
REVOKE ALL ON FUNCTION check_image_limit(UUID)
FROM anon;
CREATE OR REPLACE FUNCTION increment_image_count(p_user_id UUID, p_increment INT) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_daily INT;
v_window TIMESTAMPTZ;
v_now TIMESTAMPTZ := now();
BEGIN -- Set bypass token so the trigger allows this update
PERFORM set_config('app.allow_image_count_update', 'true', true);
-- We assume user_memory row exists because check_message_limit/increment_message_count handles initial creation.
-- But we'll do an upsert just in case.
INSERT INTO user_memory (
        user_id,
        profile,
        daily_image_count,
        daily_window_start
    )
VALUES (p_user_id, '{}'::jsonb, p_increment, v_now) ON CONFLICT (user_id) DO
UPDATE
SET daily_image_count = CASE
        WHEN user_memory.daily_window_start IS NULL
        OR v_now >= user_memory.daily_window_start + interval '24 hours' THEN p_increment
        ELSE user_memory.daily_image_count + p_increment
    END,
    daily_message_count = CASE
        WHEN user_memory.daily_window_start IS NULL
        OR v_now >= user_memory.daily_window_start + interval '24 hours' THEN 0
        ELSE user_memory.daily_message_count
    END,
    daily_window_start = CASE
        WHEN user_memory.daily_window_start IS NULL
        OR v_now >= user_memory.daily_window_start + interval '24 hours' THEN v_now
        ELSE user_memory.daily_window_start
    END
RETURNING daily_image_count INTO v_daily;
RETURN v_daily;
END;
$$;
REVOKE ALL ON FUNCTION increment_image_count(UUID, INT)
FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_image_count(UUID, INT)
FROM authenticated;
REVOKE ALL ON FUNCTION increment_image_count(UUID, INT)
FROM anon;