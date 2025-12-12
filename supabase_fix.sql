-- Run this in your Supabase SQL Editor to fix the 400 Error.

-- The error occurs because the function is trying to update 'count' instead of 'view_count'.
-- This script replaces the broken function with the correct one.

create or replace function increment_page_view(page_slug text)
returns void as $$
begin
  insert into page_views (slug, view_count, updated_at)
  values (page_slug, 1, now())
  on conflict (slug)
  do update set view_count = page_views.view_count + 1, updated_at = now();
end;
$$ language plpgsql;
