-- ============================================================
-- Migration 003 — Invite Codes, Referral Points & Auth Methods
-- PhinTech Arena | PhinTech Solutions, Kenya
-- ============================================================

-- ── REFERRAL / INVITE CODES ────────────────────────────────────────────────────
-- Each user gets one unique invite code. Others can use it when signing up.
create table if not exists public.invite_codes (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  user_id         uuid references public.profiles(id) on delete cascade not null unique,
  code            text unique not null,              -- e.g. PHIN-A3X9K
  uses            int not null default 0,
  points_earned   int not null default 0            -- total points from this code
);

-- ── REFERRAL LOG ──────────────────────────────────────────────────────────────
-- Tracks who invited whom and what points were awarded
create table if not exists public.referrals (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  referrer_id     uuid references public.profiles(id) on delete cascade not null,
  referred_id     uuid references public.profiles(id) on delete cascade not null,
  invite_code     text not null,
  points_awarded  int not null default 50,          -- points given to referrer
  bonus_claimed   boolean default false,            -- bonus after referee's first paid tourney
  unique(referred_id)                               -- each user can only be referred once
);

-- ── POINTS / WALLET ────────────────────────────────────────────────────────────
-- Gamification points separate from KES money (redeemable for discounts)
create table if not exists public.points_ledger (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  type            text not null,                    -- invite_signup|invite_paid|tournament_win|daily_login|bonus
  amount          int not null,                     -- positive = earn, negative = spend
  description     text,
  ref_id          text                              -- optional reference (e.g. referral id)
);

-- ── ADD POINTS BALANCE TO PROFILES ────────────────────────────────────────────
alter table public.profiles add column if not exists points_balance int not null default 0;
alter table public.profiles add column if not exists invite_code    text;  -- cached for fast reads
alter table public.profiles add column if not exists referred_by    uuid references public.profiles(id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.invite_codes  enable row level security;
alter table public.referrals     enable row level security;
alter table public.points_ledger enable row level security;

-- Invite codes: anyone can look up a code to validate; owner can read their own
create policy "invite_codes_public_read"  on public.invite_codes for select using (true);
create policy "invite_codes_own_insert"   on public.invite_codes for insert with check (auth.uid() = user_id);
create policy "invite_codes_own_update"   on public.invite_codes for update using (auth.uid() = user_id);

-- Referrals: user can see referrals where they are referrer or referred
create policy "referrals_read"  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);

-- Points: users see their own ledger
create policy "points_own_read" on public.points_ledger for select using (auth.uid() = user_id);

-- ── FUNCTION: generate a unique invite code ────────────────────────────────────
create or replace function public.generate_invite_code(p_user_id uuid)
returns text language plpgsql security definer as $$
declare
  v_code text;
  v_exists boolean;
begin
  -- Check if code already exists
  select code into v_code from public.invite_codes where user_id = p_user_id;
  if v_code is not null then return v_code; end if;

  -- Generate unique code: PREFIX-XXXXX (5 chars, upper-case alphanumeric)
  loop
    v_code := 'PHIN-' || upper(substring(md5(random()::text || p_user_id::text) from 1 for 5));
    select exists(select 1 from public.invite_codes where code = v_code) into v_exists;
    exit when not v_exists;
  end loop;

  insert into public.invite_codes (user_id, code) values (p_user_id, v_code);
  update public.profiles set invite_code = v_code where id = p_user_id;
  return v_code;
end;
$$;

-- ── FUNCTION: award points ─────────────────────────────────────────────────────
create or replace function public.award_points(
  p_user_id   uuid,
  p_type      text,
  p_amount    int,
  p_desc      text default null,
  p_ref_id    text default null
) returns void language plpgsql security definer as $$
begin
  insert into public.points_ledger (user_id, type, amount, description, ref_id)
  values (p_user_id, p_type, p_amount, p_desc, p_ref_id);

  update public.profiles
  set points_balance = points_balance + p_amount,
      updated_at     = now()
  where id = p_user_id;
end;
$$;

-- ── FUNCTION: process referral on new user ────────────────────────────────────
-- Called after a user completes their profile with an invite code
create or replace function public.process_referral(
  p_referred_id uuid,
  p_invite_code text
) returns jsonb language plpgsql security definer as $$
declare
  v_referrer_id uuid;
  v_code_row    record;
begin
  -- Look up invite code
  select * into v_code_row from public.invite_codes where code = upper(p_invite_code);
  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid invite code');
  end if;

  -- Can't invite yourself
  if v_code_row.user_id = p_referred_id then
    return jsonb_build_object('success', false, 'error', 'Cannot use your own invite code');
  end if;

  v_referrer_id := v_code_row.user_id;

  -- Already referred?
  if exists(select 1 from public.referrals where referred_id = p_referred_id) then
    return jsonb_build_object('success', false, 'error', 'Already referred');
  end if;

  -- Record referral
  insert into public.referrals (referrer_id, referred_id, invite_code, points_awarded)
  values (v_referrer_id, p_referred_id, upper(p_invite_code), 50);

  -- Update invite code usage
  update public.invite_codes
  set uses = uses + 1, points_earned = points_earned + 50
  where code = upper(p_invite_code);

  -- Award 50 pts to referrer
  perform public.award_points(v_referrer_id, 'invite_signup', 50,
    'Friend signed up using your invite code', p_referred_id::text);

  -- Award 20 pts to new user (welcome bonus for using a code)
  perform public.award_points(p_referred_id, 'invite_signup', 20,
    'Welcome bonus — joined via invite code', upper(p_invite_code));

  -- Save who referred the new user
  update public.profiles set referred_by = v_referrer_id where id = p_referred_id;

  return jsonb_build_object('success', true, 'referrer_id', v_referrer_id, 'points_earned', 50);
end;
$$;

-- ── AUTO-GENERATE invite code on new user signup ──────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  insert into public.profiles (id, full_name, avatar_url, email_notify, whatsapp_notify)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    true,
    true
  )
  on conflict (id) do nothing;

  -- Auto-generate an invite code for the new user
  v_code := public.generate_invite_code(new.id);

  -- Award daily login / welcome points
  perform public.award_points(new.id, 'bonus', 10, 'Welcome to PhinTech Arena!');

  return new;
end;
$$;

-- Drop and recreate trigger to use updated function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
