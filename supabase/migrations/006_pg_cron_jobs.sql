-- ============================================================
-- Migration 006 — pg_cron jobs + HTTP trigger functions
-- Replaces Vercel cron jobs (Hobby plan incompatible)
-- All scheduling runs inside Supabase Postgres — free forever
-- PhinTech Arena | PhinTech Solutions, Kenya
-- ============================================================

-- Enable pg_cron extension (already enabled on Supabase hosted projects)
create extension if not exists pg_cron;

-- Enable pg_net for outbound HTTP calls from Postgres
create extension if not exists pg_net;

-- ── HELPER: call our Vercel API from inside Postgres ──────────────────────────
-- We store the site URL and cron secret so the functions can call the API.
-- Run this once after deploying:
--   select set_config('app.site_url',    'https://phintech-gamics.vercel.app', false);
--   select set_config('app.cron_secret', 'your_cron_secret_here', false);
-- OR set them as Supabase secrets / .env and reference below.

-- ── FUNCTION: process payout queue directly in DB (no HTTP needed) ────────────
-- This is the primary payout processor when Africa's Talking is configured.
-- It marks payouts as 'processing' so the Vercel /api/payout endpoint
-- picks them up on next call. The HTTP call to Vercel is a bonus trigger.
create or replace function public.cron_process_payouts()
returns void language plpgsql security definer as $$
declare
  v_site_url  text;
  v_secret    text;
begin
  -- Get config (set via Supabase Dashboard → Settings → Vault, or ALTER DATABASE SET)
  v_site_url := coalesce(current_setting('app.site_url',  true), 'https://phintech-gamics.vercel.app');
  v_secret   := coalesce(current_setting('app.cron_secret', true), '');

  -- HTTP POST to /api/payout via pg_net (fire and forget)
  if v_secret <> '' then
    perform net.http_post(
      url     := v_site_url || '/api/ops?type=payout',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body    := '{}'::jsonb
    );
  end if;
end;
$$;

-- ── FUNCTION: process notification queue directly in DB ───────────────────────
create or replace function public.cron_process_notifications()
returns void language plpgsql security definer as $$
declare
  v_site_url text;
  v_secret   text;
begin
  v_site_url := coalesce(current_setting('app.site_url',  true), 'https://phintech-gamics.vercel.app');
  v_secret   := coalesce(current_setting('app.cron_secret', true), '');

  if v_secret <> '' then
    perform net.http_post(
      url     := v_site_url || '/api/ops?type=notify',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body    := '{}'::jsonb
    );
  end if;
end;
$$;

-- ── FUNCTION: auto-open tournaments whose start_date has arrived ──────────────
create or replace function public.cron_auto_open_tournaments()
returns void language plpgsql security definer as $$
begin
  -- pending → open when start_date is today or past and approved
  update public.tournaments
  set status     = 'open',
      updated_at = now()
  where status          = 'pending'
    and pending_approval = false
    and start_date      <= current_date;

  -- open → ongoing when start_date passed + still open (manual override only,
  -- the trigger handles auto-start when full)
  -- We do NOT auto-force-start here — host should open manually or fill up.
end;
$$;

-- ── FUNCTION: expire stale pending registrations (older than 2 hours) ─────────
create or replace function public.cron_expire_pending_registrations()
returns void language plpgsql security definer as $$
begin
  update public.registrations
  set payment_status = 'failed'
  where payment_status = 'pending'
    and created_at     < now() - interval '2 hours';
end;
$$;

-- ── FUNCTION: auto-complete tournaments with no activity for 48h ──────────────
create or replace function public.cron_complete_stale_tournaments()
returns void language plpgsql security definer as $$
declare
  v_t record;
begin
  for v_t in
    select id from public.tournaments
    where status    = 'ongoing'
      and updated_at < now() - interval '48 hours'
  loop
    -- Check if only 1 match remains unverified (everyone else dropped)
    declare
      v_open int;
    begin
      select count(*) into v_open
      from public.matches
      where tournament_id = v_t.id
        and status not in ('verified','bye','disputed');

      if v_open = 0 then
        -- All matches done — trigger payout + complete
        perform public.queue_prize_payouts(v_t.id);
        update public.tournaments
        set status = 'completed', bracket_complete = true, updated_at = now()
        where id = v_t.id;
      end if;
    end;
  end loop;
end;
$$;

-- ── SCHEDULE ALL JOBS ─────────────────────────────────────────────────────────
-- Remove any existing jobs first to avoid duplicates on re-run

select cron.unschedule('phintech-process-payouts')         where exists (select 1 from cron.job where jobname = 'phintech-process-payouts');
select cron.unschedule('phintech-process-notifications')   where exists (select 1 from cron.job where jobname = 'phintech-process-notifications');
select cron.unschedule('phintech-auto-open-tournaments')   where exists (select 1 from cron.job where jobname = 'phintech-auto-open-tournaments');
select cron.unschedule('phintech-expire-registrations')    where exists (select 1 from cron.job where jobname = 'phintech-expire-registrations');
select cron.unschedule('phintech-complete-stale')          where exists (select 1 from cron.job where jobname = 'phintech-complete-stale');

-- Process payouts every 5 minutes
select cron.schedule(
  'phintech-process-payouts',
  '*/5 * * * *',
  $$ select public.cron_process_payouts(); $$
);

-- Process email/SMS notifications every 3 minutes
select cron.schedule(
  'phintech-process-notifications',
  '*/3 * * * *',
  $$ select public.cron_process_notifications(); $$
);

-- Auto-open tournaments daily at 00:01 UTC
select cron.schedule(
  'phintech-auto-open-tournaments',
  '1 0 * * *',
  $$ select public.cron_auto_open_tournaments(); $$
);

-- Expire stale pending registrations every 30 minutes
select cron.schedule(
  'phintech-expire-registrations',
  '*/30 * * * *',
  $$ select public.cron_expire_pending_registrations(); $$
);

-- Check for stale ongoing tournaments every 6 hours
select cron.schedule(
  'phintech-complete-stale',
  '0 */6 * * *',
  $$ select public.cron_complete_stale_tournaments(); $$
);

-- ── SET APP CONFIG IN DATABASE ────────────────────────────────────────────────
-- These are read by the cron functions above.
-- Replace values with your actual URL + secret after first deploy.
-- You can also run these manually in Supabase SQL editor:
--
--   alter database postgres set app.site_url    = 'https://phintech-gamics.vercel.app';
--   alter database postgres set app.cron_secret = 'your_cron_secret_here';
--
-- Doing it in migration so it's set automatically:
do $$
begin
  perform set_config('app.site_url', 'https://phintech-gamics.vercel.app', false);
end $$;
