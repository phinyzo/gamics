-- Migration 007 — Newsletter subscribers
-- PhinTech Arena | PhinTech Solutions, Kenya

create table if not exists public.newsletter_subscribers (
  id         uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  email      text unique not null,
  source     text default 'website',  -- website|arena|footer
  active     boolean default true
);

alter table public.newsletter_subscribers enable row level security;
-- Only service role can read (admin only via API)
-- No public insert policy — we insert via service role from the API
