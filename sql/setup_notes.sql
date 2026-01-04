-- Visitor Notes Table for Landing Page Guestbook
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard
-- 1. Create the table
create table if not exists visitor_notes (
    id bigserial primary key,
    name varchar(50),
    message text not null check (char_length(message) <= 280),
    created_at timestamptz default now()
);
-- 2. Enable Row Level Security
alter table visitor_notes enable row level security;
-- 3. Allow anyone to read notes
create policy "Anyone can read notes" on visitor_notes for
select using (true);
-- 4. Allow anyone to insert notes (public guestbook)
create policy "Anyone can insert notes" on visitor_notes for
insert with check (true);
-- 5. Create index for faster ordering
create index if not exists idx_visitor_notes_created_at on visitor_notes (created_at desc);