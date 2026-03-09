-- Contact messages received via support@kernel.chat inbound webhook
-- ================================================================

create table if not exists public.contact_messages (
  id            uuid primary key default gen_random_uuid(),
  from_email    text not null,
  from_name     text,
  subject       text,
  body_text     text,
  body_html     text,
  received_at   timestamptz not null default now(),
  read          boolean not null default false,
  archived      boolean not null default false
);

-- Index for unread polling (inbox-sync script)
create index idx_contact_messages_unread
  on public.contact_messages (read, received_at desc)
  where not read and not archived;

-- RLS: service_role only (no public/authenticated access)
alter table public.contact_messages enable row level security;

-- No policies = no access for anon/authenticated roles
-- Only service_role key bypasses RLS

comment on table public.contact_messages is
  'Inbound emails received at support@kernel.chat via Resend webhook';
