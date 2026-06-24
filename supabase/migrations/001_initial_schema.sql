-- ============================================================
-- PhinTech Arena — Supabase Database Schema
-- Powered by PhinTech Solutions, Kenya
-- ============================================================

-- Enable UUID extension
-- uuid-ossp not needed; using gen_random_uuid()

-- ── PROFILES ──────────────────────────────────────────────────────────────────
-- Extended user profile linked to Supabase Auth
create table if not exists public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  gamer_tag       text unique,
  full_name       text,
  avatar_url      text,
  phone           text,           -- M-Pesa +254 number
  county          text,           -- Kenyan county
  platform_id     text,           -- PSN/GT/Steam ID
  preferred_game  text,
  email_notify    boolean default true,
  whatsapp_notify boolean default true
);

-- ── TOURNAMENTS ───────────────────────────────────────────────────────────────
create table if not exists public.tournaments (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  host_id         uuid references public.profiles(id),
  name            text not null,
  game            text not null,
  format          text not null default 'single',   -- single|double|roundrobin|swiss
  max_players     int  not null default 16,
  entry_fee       int  not null default 100,         -- KES
  prize_pool      int  not null default 0,           -- KES
  platform        text not null default 'PS5',
  status          text not null default 'pending',   -- pending|open|ongoing|completed|cancelled
  start_date      date,
  rules           text,
  host_name       text,
  host_contact    text,
  pending_approval boolean default true,
  banner_url      text
);

-- ── REGISTRATIONS ─────────────────────────────────────────────────────────────
create table if not exists public.registrations (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  tournament_id   uuid references public.tournaments(id) on delete cascade not null,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  gamer_tag       text not null,
  phone           text not null,
  platform_id     text,
  county          text,
  payment_status  text not null default 'pending',  -- pending|paid|failed
  payment_ref     text,
  mpesa_code      text,
  seed            int,                               -- bracket seed position
  unique(tournament_id, user_id),
  unique(tournament_id, gamer_tag)
);

-- ── MATCHES ───────────────────────────────────────────────────────────────────
create table if not exists public.matches (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  tournament_id   uuid references public.tournaments(id) on delete cascade not null,
  round           int not null default 1,
  match_number    int not null default 1,
  player1_tag     text,
  player2_tag     text,
  score1          int,
  score2          int,
  winner_tag      text,
  status          text not null default 'pending',   -- pending|p1_submitted|p2_submitted|verified|disputed|bye
  screenshot_url  text,
  verified_at     timestamptz,
  dispute_reason  text
);

-- ── LEADERBOARD (materialised ELO) ────────────────────────────────────────────
create table if not exists public.leaderboard (
  id              uuid default gen_random_uuid() primary key,
  updated_at      timestamptz default now() not null,
  user_id         uuid references public.profiles(id) on delete cascade,
  gamer_tag       text not null,
  game            text not null,
  elo             int not null default 1500,
  wins            int not null default 0,
  losses          int not null default 0,
  prize_won       int not null default 0,           -- KES total
  unique(gamer_tag, game)
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  type            text not null,                    -- tournament_reminder|match_ready|result_verified|prize_paid
  title           text not null,
  message         text not null,
  read            boolean default false,
  data            jsonb
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.tournaments   enable row level security;
alter table public.registrations enable row level security;
alter table public.matches       enable row level security;
alter table public.leaderboard   enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users can read all, only update their own
create policy "profiles_public_read"  on public.profiles for select using (true);
create policy "profiles_own_update"   on public.profiles for update using (auth.uid() = id);
create policy "profiles_own_insert"   on public.profiles for insert with check (auth.uid() = id);

-- Tournaments: anyone can read approved ones; auth users can insert
create policy "tournaments_public_read"  on public.tournaments for select using (pending_approval = false or host_id = auth.uid());
create policy "tournaments_auth_insert"  on public.tournaments for insert with check (auth.uid() = host_id);
create policy "tournaments_own_update"   on public.tournaments for update using (auth.uid() = host_id);

-- Registrations: users see their own; tournament host sees all for their tournament
create policy "registrations_own"        on public.registrations for select using (auth.uid() = user_id);
create policy "registrations_auth_insert"on public.registrations for insert with check (auth.uid() = user_id);

-- Matches: public read; only system (service role) writes
create policy "matches_public_read"      on public.matches for select using (true);

-- Leaderboard: fully public read
create policy "leaderboard_public_read"  on public.leaderboard for select using (true);

-- Notifications: users see their own only
create policy "notifications_own"        on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_own_update" on public.notifications for update using (auth.uid() = user_id);

-- ── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email_notify, whatsapp_notify)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    true,
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── ELO UPDATE FUNCTION ───────────────────────────────────────────────────────
create or replace function public.update_elo(
  p_winner_tag text, p_loser_tag text, p_game text,
  p_winner_uid uuid default null, p_loser_uid uuid default null
) returns void language plpgsql security definer as $$
declare
  v_winner_elo int; v_loser_elo int;
  v_expected   float; v_k int := 32;
begin
  select coalesce((select elo from public.leaderboard where gamer_tag=p_winner_tag and game=p_game), 1500)
    into v_winner_elo;
  select coalesce((select elo from public.leaderboard where gamer_tag=p_loser_tag  and game=p_game), 1500)
    into v_loser_elo;

  v_expected := 1.0 / (1.0 + power(10.0, (v_loser_elo - v_winner_elo)::float / 400.0));

  insert into public.leaderboard (gamer_tag, game, user_id, elo, wins, losses)
    values (p_winner_tag, p_game, p_winner_uid,
            v_winner_elo + round(v_k*(1-v_expected)), 1, 0)
  on conflict (gamer_tag, game) do update
    set elo = leaderboard.elo + round(v_k*(1-v_expected)),
        wins = leaderboard.wins + 1,
        updated_at = now();

  insert into public.leaderboard (gamer_tag, game, user_id, elo, wins, losses)
    values (p_loser_tag, p_game, p_loser_uid,
            v_loser_elo + round(v_k*(0-(1-v_expected))), 0, 1)
  on conflict (gamer_tag, game) do update
    set elo = leaderboard.elo + round(v_k*(0-(1-v_expected))),
        losses = leaderboard.losses + 1,
        updated_at = now();
end;
$$;
