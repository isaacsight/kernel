-- Temporary: set test account message count to 198 for overage testing
-- Safe to delete this migration file after testing
UPDATE user_memory
SET monthly_message_count = 198,
    monthly_window_start = date_trunc('month', NOW())
WHERE user_id = '44f464ad-f593-441d-9c5b-cf4ab3774fd9';
