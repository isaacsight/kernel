-- Notification triggers: sends Discord webhook notifications
-- for new user signups and new active subscriptions.
--
-- Requires the `pg_net` extension (enabled by default on Supabase)
-- and the `notify-webhook` Edge Function deployed.
--
-- Run this in Supabase Dashboard -> SQL Editor

-- Ensure pg_net extension is available for HTTP requests from SQL
create extension if not exists pg_net with schema extensions;

-- ============================================================
-- 1. Notify on new user signup (auth.users INSERT)
-- ============================================================

create or replace function public.notify_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_role_key text := current_setting('app.settings.service_role_key', true);
  _function_url text;
  _provider text;
begin
  -- Build the Edge Function URL
  _function_url := coalesce(_supabase_url, 'https://eoxxpyixdieprsxlpwcs.supabase.co')
    || '/functions/v1/notify-webhook';

  -- Extract the auth provider from raw_app_meta_data
  _provider := coalesce(
    NEW.raw_app_meta_data ->> 'provider',
    'email'
  );

  -- Fire-and-forget HTTP POST to the Edge Function via pg_net
  perform net.http_post(
    url := _function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(_service_role_key, '')
    ),
    body := jsonb_build_object(
      'event_type', 'new_user',
      'email', coalesce(NEW.email, ''),
      'provider', _provider,
      'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  return NEW;
end;
$$;

-- Drop existing trigger if present (idempotent)
drop trigger if exists on_new_user_notify on auth.users;

create trigger on_new_user_notify
  after insert on auth.users
  for each row
  execute function public.notify_new_user();


-- ============================================================
-- 2. Notify on new active subscription (subscriptions INSERT/UPDATE)
-- ============================================================

create or replace function public.notify_new_subscriber()
returns trigger
language plpgsql
security definer
as $$
declare
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_role_key text := current_setting('app.settings.service_role_key', true);
  _function_url text;
  _user_email text;
begin
  -- Only fire when status becomes 'active'
  -- For INSERT: always fire if status = 'active'
  -- For UPDATE: only fire if status changed to 'active'
  if NEW.status <> 'active' then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and OLD.status = 'active' then
    -- Already active, no need to notify again
    return NEW;
  end if;

  -- Build the Edge Function URL
  _function_url := coalesce(_supabase_url, 'https://eoxxpyixdieprsxlpwcs.supabase.co')
    || '/functions/v1/notify-webhook';

  -- Look up the user's email from auth.users
  select email into _user_email
  from auth.users
  where id = NEW.user_id;

  -- Fire-and-forget HTTP POST to the Edge Function via pg_net
  perform net.http_post(
    url := _function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(_service_role_key, '')
    ),
    body := jsonb_build_object(
      'event_type', 'new_subscriber',
      'email', coalesce(_user_email, ''),
      'plan', 'Pro',
      'stripe_customer_id', coalesce(NEW.stripe_customer_id, '')
    )
  );

  return NEW;
end;
$$;

-- Drop existing trigger if present (idempotent)
drop trigger if exists on_new_subscriber_notify on public.subscriptions;

create trigger on_new_subscriber_notify
  after insert or update on public.subscriptions
  for each row
  execute function public.notify_new_subscriber();
