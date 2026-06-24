-- Add gender, avatar_url, and preferred_game columns to profiles
alter table public.profiles add column if not exists gender       text;
alter table public.profiles add column if not exists preferred_game text;
-- avatar_url already exists from initial migration
