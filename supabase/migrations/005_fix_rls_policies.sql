-- ============================================================
-- Migration 005 — Fix duplicate RLS policies from 004
-- Drops and recreates all policies idempotently
-- PhinTech Arena | PhinTech Solutions, Kenya
-- ============================================================

-- ── DROP existing policies to allow clean re-creation ─────────────────────────

do $$ begin
  -- wallets
  drop policy if exists "wallets_own"           on public.wallets;
  drop policy if exists "wallet_tx_own"         on public.wallet_transactions;
  drop policy if exists "payout_own"            on public.payout_queue;
  drop policy if exists "admin_roles_admin"     on public.admin_roles;
  drop policy if exists "disputes_public_read"  on public.dispute_resolutions;
  drop policy if exists "screenshots_own"       on public.match_screenshots;
  drop policy if exists "screenshots_insert"    on public.match_screenshots;
  drop policy if exists "notif_queue_own"       on public.notification_queue;
exception when others then null;
end $$;

-- ── Ensure RLS is enabled on all new tables ────────────────────────────────────
alter table if exists public.wallets                enable row level security;
alter table if exists public.wallet_transactions    enable row level security;
alter table if exists public.payout_queue           enable row level security;
alter table if exists public.admin_roles            enable row level security;
alter table if exists public.dispute_resolutions    enable row level security;
alter table if exists public.match_screenshots      enable row level security;
alter table if exists public.notification_queue     enable row level security;
alter table if exists public.platform_revenue       enable row level security;

-- ── Recreate policies ─────────────────────────────────────────────────────────

-- Wallets: users see only their own
create policy "wallets_own"
  on public.wallets for select
  using (auth.uid() = user_id);

-- Wallet transactions: users see their own
create policy "wallet_tx_own"
  on public.wallet_transactions for select
  using (auth.uid() = user_id);

-- Payout queue: users see their own payouts
create policy "payout_own"
  on public.payout_queue for select
  using (auth.uid() = user_id);

-- Admin roles: admins can see all, users see their own
create policy "admin_roles_admin"
  on public.admin_roles for select
  using (
    auth.uid() = user_id
    or exists(select 1 from public.admin_roles where user_id = auth.uid())
  );

-- Dispute resolutions: public read
create policy "disputes_public_read"
  on public.dispute_resolutions for select
  using (true);

-- Match screenshots: submitter sees own
create policy "screenshots_own"
  on public.match_screenshots for select
  using (auth.uid() = submitted_by);

create policy "screenshots_insert"
  on public.match_screenshots for insert
  with check (auth.uid() = submitted_by);

-- Notification queue: users see their own
create policy "notif_queue_own"
  on public.notification_queue for select
  using (auth.uid() = user_id);

-- ── Verify the columns that were flagged as "already exists" are present ───────
-- (These are NOOPs — just confirming the columns exist correctly)
alter table public.registrations add column if not exists check_in        boolean default false;
alter table public.registrations add column if not exists checked_in_at   timestamptz;
alter table public.profiles      add column if not exists is_admin         boolean not null default false;
alter table public.tournaments   add column if not exists current_round    int  not null default 1;
alter table public.tournaments   add column if not exists total_rounds     int  not null default 0;
alter table public.tournaments   add column if not exists bracket_complete boolean not null default false;
alter table public.tournaments   add column if not exists auto_payout      boolean not null default true;
alter table public.tournaments   add column if not exists platform_fee_pct int  not null default 10;
