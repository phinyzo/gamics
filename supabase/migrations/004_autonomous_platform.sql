-- ============================================================
-- Migration 004 — Autonomous Platform
-- Prize Payouts · Wallets · Admin · Bracket Auto-Progression
-- Screenshot Storage · Email/SMS Queue · Dispute Resolution
-- PhinTech Arena | PhinTech Solutions, Kenya
-- ============================================================

-- ── KES WALLET ────────────────────────────────────────────────────────────────
-- Each user has a KES balance (separate from gamification points)
create table if not exists public.wallets (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade unique not null,
  balance_kes     int not null default 0,    -- balance in KES (integer, no fractions)
  total_deposited int not null default 0,
  total_withdrawn int not null default 0,
  updated_at      timestamptz default now() not null
);

-- ── WALLET TRANSACTIONS ────────────────────────────────────────────────────────
create table if not exists public.wallet_transactions (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  type            text not null,             -- deposit|withdrawal|entry_fee|prize|refund|platform_fee
  amount_kes      int not null,              -- positive=credit, negative=debit
  balance_after   int not null default 0,
  status          text not null default 'completed', -- pending|completed|failed
  ref             text,                      -- mpesa code / internal ref
  description     text,
  tournament_id   uuid references public.tournaments(id) on delete set null,
  meta            jsonb
);

-- ── PAYOUT QUEUE ──────────────────────────────────────────────────────────────
-- Automated payout processing: populated by bracket completion, processed by cron
create table if not exists public.payout_queue (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  processed_at    timestamptz,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  tournament_id   uuid references public.tournaments(id) on delete cascade not null,
  phone           text not null,             -- 254XXXXXXXXX
  amount_kes      int not null,
  placement       int not null default 1,    -- 1=winner, 2=runner-up, etc.
  status          text not null default 'pending', -- pending|processing|paid|failed
  mpesa_code      text,
  failure_reason  text,
  retry_count     int not null default 0
);

-- ── ADMIN ROLES ───────────────────────────────────────────────────────────────
create table if not exists public.admin_roles (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade unique not null,
  role            text not null default 'admin',  -- admin|moderator|support
  granted_at      timestamptz default now() not null,
  granted_by      uuid references public.profiles(id)
);

-- ── DISPUTE RESOLUTION ────────────────────────────────────────────────────────
-- Extends matches table — admin decisions logged here
create table if not exists public.dispute_resolutions (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  match_id        uuid references public.matches(id) on delete cascade not null,
  tournament_id   uuid references public.tournaments(id) on delete cascade not null,
  resolved_by     uuid references public.profiles(id) not null,
  winner_tag      text not null,
  loser_tag       text not null,
  resolution_note text,
  evidence_url    text   -- admin screenshot/evidence URL
);

-- ── SCREENSHOT STORAGE ────────────────────────────────────────────────────────
-- Records screenshots submitted with match results
create table if not exists public.match_screenshots (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  match_id        uuid references public.matches(id) on delete cascade,
  tournament_id   uuid references public.tournaments(id) on delete cascade,
  submitted_by    uuid references public.profiles(id) not null,
  gamer_tag       text not null,
  storage_path    text not null,             -- supabase storage path
  public_url      text,
  file_size       int,
  reviewed        boolean default false
);

-- ── NOTIFICATION QUEUE (outbound email/SMS) ────────────────────────────────────
create table if not exists public.notification_queue (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  sent_at         timestamptz,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  channel         text not null,             -- email|sms|whatsapp
  recipient       text not null,             -- email address or phone number
  subject         text,
  body            text not null,
  status          text not null default 'pending', -- pending|sent|failed
  failure_reason  text,
  retry_count     int not null default 0,
  meta            jsonb
);

-- ── TOURNAMENT BRACKET STATE ───────────────────────────────────────────────────
-- Tracks current state of auto-progressed brackets
alter table public.tournaments add column if not exists current_round    int not null default 1;
alter table public.tournaments add column if not exists total_rounds     int not null default 0;
alter table public.tournaments add column if not exists bracket_complete boolean not null default false;
alter table public.tournaments add column if not exists auto_payout      boolean not null default true;
alter table public.tournaments add column if not exists platform_fee_pct int not null default 10; -- % platform takes

-- Add seeding column to registrations if missing
alter table public.registrations add column if not exists check_in boolean default false;
alter table public.registrations add column if not exists checked_in_at timestamptz;

-- ── ADD WALLET ID TO PROFILES ─────────────────────────────────────────────────
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.wallets                enable row level security;
alter table public.wallet_transactions    enable row level security;
alter table public.payout_queue           enable row level security;
alter table public.admin_roles            enable row level security;
alter table public.dispute_resolutions    enable row level security;
alter table public.match_screenshots      enable row level security;
alter table public.notification_queue     enable row level security;

-- Wallets: users see only their own
create policy "wallets_own"           on public.wallets             for select using (auth.uid() = user_id);
create policy "wallet_tx_own"         on public.wallet_transactions for select using (auth.uid() = user_id);
create policy "payout_own"            on public.payout_queue        for select using (auth.uid() = user_id);
create policy "admin_roles_admin"     on public.admin_roles         for select using (
  auth.uid() = user_id or exists(select 1 from public.admin_roles where user_id = auth.uid())
);
create policy "disputes_public_read"  on public.dispute_resolutions for select using (true);
create policy "screenshots_own"       on public.match_screenshots   for select using (auth.uid() = submitted_by);
create policy "screenshots_insert"    on public.match_screenshots   for insert with check (auth.uid() = submitted_by);
create policy "notif_queue_own"       on public.notification_queue  for select using (auth.uid() = user_id);

-- Allow service role full access (Vercel API functions use service role)
-- (service role bypasses RLS by default in Supabase)

-- ── FUNCTION: get or create wallet ────────────────────────────────────────────
create or replace function public.get_or_create_wallet(p_user_id uuid)
returns public.wallets language plpgsql security definer as $$
declare
  v_wallet public.wallets;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id;
  if not found then
    insert into public.wallets (user_id) values (p_user_id)
    returning * into v_wallet;
  end if;
  return v_wallet;
end;
$$;

-- ── FUNCTION: credit wallet ────────────────────────────────────────────────────
create or replace function public.credit_wallet(
  p_user_id     uuid,
  p_amount      int,
  p_type        text,
  p_desc        text       default null,
  p_ref         text       default null,
  p_tournament  uuid       default null
) returns public.wallets language plpgsql security definer as $$
declare
  v_wallet public.wallets;
begin
  -- Ensure wallet exists
  perform public.get_or_create_wallet(p_user_id);

  update public.wallets
  set balance_kes     = balance_kes + p_amount,
      total_deposited = case when p_amount > 0 then total_deposited + p_amount else total_deposited end,
      updated_at      = now()
  where user_id = p_user_id
  returning * into v_wallet;

  insert into public.wallet_transactions
    (user_id, type, amount_kes, balance_after, ref, description, tournament_id)
  values
    (p_user_id, p_type, p_amount, v_wallet.balance_kes, p_ref, p_desc, p_tournament);

  return v_wallet;
end;
$$;

-- ── FUNCTION: debit wallet (returns false if insufficient) ─────────────────────
create or replace function public.debit_wallet(
  p_user_id     uuid,
  p_amount      int,
  p_type        text,
  p_desc        text       default null,
  p_ref         text       default null,
  p_tournament  uuid       default null
) returns boolean language plpgsql security definer as $$
declare
  v_wallet public.wallets;
begin
  perform public.get_or_create_wallet(p_user_id);

  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if v_wallet.balance_kes < p_amount then
    return false; -- insufficient
  end if;

  update public.wallets
  set balance_kes     = balance_kes - p_amount,
      total_withdrawn = total_withdrawn + p_amount,
      updated_at      = now()
  where user_id = p_user_id;

  insert into public.wallet_transactions
    (user_id, type, amount_kes, balance_after, ref, description, tournament_id)
  values
    (p_user_id, p_type, -p_amount, v_wallet.balance_kes - p_amount, p_ref, p_desc, p_tournament);

  return true;
end;
$$;

-- ── FUNCTION: auto-generate next bracket round ────────────────────────────────
create or replace function public.advance_bracket(p_tournament_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_t              record;
  v_current_round  int;
  v_match          record;
  v_winners        text[];
  v_new_matches    int := 0;
  v_i              int;
  v_match_num      int;
begin
  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Tournament not found');
  end if;

  v_current_round := v_t.current_round;

  -- Check all matches in current round are verified or bye
  if exists (
    select 1 from public.matches
    where tournament_id = p_tournament_id
      and round = v_current_round
      and status not in ('verified', 'bye')
  ) then
    return jsonb_build_object('success', false, 'error', 'Not all matches in current round are complete');
  end if;

  -- Collect winners from current round
  select array_agg(winner_tag order by match_number)
  into v_winners
  from public.matches
  where tournament_id = p_tournament_id
    and round = v_current_round
    and status in ('verified', 'bye');

  if v_winners is null or array_length(v_winners, 1) < 2 then
    -- Tournament complete — only 1 (or 0) players left
    update public.tournaments
    set status = 'completed', bracket_complete = true, updated_at = now()
    where id = p_tournament_id;

    -- Queue payout for winner
    perform public.queue_prize_payouts(p_tournament_id);

    return jsonb_build_object('success', true, 'action', 'tournament_complete');
  end if;

  -- Create next round matches
  v_match_num := 1;
  v_i := 1;
  while v_i <= array_length(v_winners, 1) loop
    insert into public.matches (
      tournament_id, round, match_number,
      player1_tag, player2_tag, status
    ) values (
      p_tournament_id,
      v_current_round + 1,
      v_match_num,
      v_winners[v_i],
      coalesce(v_winners[v_i + 1], 'BYE'),
      case when v_winners[v_i + 1] is null then 'bye' else 'pending' end
    );
    -- If BYE, auto-set winner
    if v_winners[v_i + 1] is null then
      update public.matches
      set winner_tag = v_winners[v_i], verified_at = now()
      where tournament_id = p_tournament_id
        and round = v_current_round + 1
        and match_number = v_match_num;
    end if;
    v_new_matches := v_new_matches + 1;
    v_match_num   := v_match_num + 1;
    v_i           := v_i + 2;
  end loop;

  -- Advance round counter
  update public.tournaments
  set current_round = v_current_round + 1,
      status        = 'ongoing',
      updated_at    = now()
  where id = p_tournament_id;

  -- Notify all participants
  insert into public.notifications (user_id, type, title, message, data)
  select r.user_id,
         'match_ready',
         '⚔️ Round ' || (v_current_round + 1) || ' has started!',
         'Your next match is ready in tournament: ' || v_t.name,
         jsonb_build_object('tournament_id', p_tournament_id, 'round', v_current_round + 1)
  from public.registrations r
  where r.tournament_id = p_tournament_id
    and r.payment_status = 'paid';

  return jsonb_build_object(
    'success', true,
    'new_round', v_current_round + 1,
    'matches_created', v_new_matches
  );
end;
$$;

-- ── FUNCTION: queue prize payouts after tournament completes ──────────────────
create or replace function public.queue_prize_payouts(p_tournament_id uuid)
returns void language plpgsql security definer as $$
declare
  v_t         record;
  v_winner    record;
  v_runner    record;
  v_prize     int;
  v_fee       int;
  v_net_pool  int;
begin
  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found or not v_t.auto_payout then return; end if;

  -- Calculate net prize pool after platform fee
  v_fee      := round(v_t.prize_pool * v_t.platform_fee_pct / 100.0);
  v_net_pool := v_t.prize_pool - v_fee;

  -- Find winner (last verified match winner)
  select m.winner_tag, r.user_id, r.phone
  into v_winner
  from public.matches m
  join public.registrations r on r.gamer_tag = m.winner_tag and r.tournament_id = m.tournament_id
  where m.tournament_id = p_tournament_id
    and m.status = 'verified'
  order by m.round desc
  limit 1;

  if v_winner.user_id is null then return; end if;

  -- 60% to winner, 20% to runner-up if pool >= 2000
  if v_net_pool >= 2000 then
    v_prize := round(v_net_pool * 0.6);
  else
    v_prize := v_net_pool;
  end if;

  -- Queue winner payout
  insert into public.payout_queue
    (user_id, tournament_id, phone, amount_kes, placement, status)
  values
    (v_winner.user_id, p_tournament_id, v_winner.phone, v_prize, 1, 'pending')
  on conflict do nothing;

  -- Credit winner wallet
  perform public.credit_wallet(
    v_winner.user_id, v_prize, 'prize',
    '🏆 Prize: ' || v_t.name, 'PRIZE-' || v_t.id, p_tournament_id
  );

  -- Award points
  perform public.award_points(v_winner.user_id, 'tournament_win', 100,
    'Won tournament: ' || v_t.name, p_tournament_id::text);

  -- Update leaderboard prize_won
  update public.leaderboard
  set prize_won = prize_won + v_prize, updated_at = now()
  where gamer_tag = v_winner.winner_tag;

  -- Notify winner
  insert into public.notifications (user_id, type, title, message, data)
  values (
    v_winner.user_id, 'prize_paid',
    '🏆 Prize Incoming! KES ' || v_prize,
    'You won ' || v_t.name || '! KES ' || v_prize || ' is being sent to your M-Pesa.',
    jsonb_build_object('tournament_id', p_tournament_id, 'amount', v_prize)
  );

  -- Queue outbound SMS to winner
  insert into public.notification_queue
    (user_id, channel, recipient, subject, body)
  values (
    v_winner.user_id, 'sms', v_winner.phone,
    null,
    'PhinTech Arena: Congrats! You won ' || v_t.name || '. KES ' || v_prize ||
    ' is being sent to your M-Pesa. Well played!'
  );
end;
$$;

-- ── FUNCTION: check-in player ─────────────────────────────────────────────────
create or replace function public.player_check_in(p_tournament_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer as $$
begin
  update public.registrations
  set check_in = true, checked_in_at = now()
  where tournament_id = p_tournament_id and user_id = p_user_id;
  return found;
end;
$$;

-- ── FUNCTION: auto start tournament when full ──────────────────────────────────
create or replace function public.maybe_start_tournament()
returns trigger language plpgsql security definer as $$
declare
  v_t       record;
  v_count   int;
  v_rounds  int;
begin
  -- Triggered after a registration is marked paid
  if NEW.payment_status <> 'paid' then return NEW; end if;

  select * into v_t from public.tournaments where id = NEW.tournament_id;
  if v_t.status <> 'open' then return NEW; end if;

  -- Count paid registrations
  select count(*) into v_count
  from public.registrations
  where tournament_id = NEW.tournament_id and payment_status = 'paid';

  -- Start if full OR start_date reached
  if v_count >= v_t.max_players then
    -- Calculate rounds needed
    v_rounds := ceil(log(2, greatest(v_count, 2)));

    -- Generate round 1 matches
    update public.tournaments
    set status       = 'ongoing',
        current_round = 1,
        total_rounds  = v_rounds,
        updated_at    = now()
    where id = NEW.tournament_id;

    -- Generate round 1 bracket
    insert into public.matches (tournament_id, round, match_number, player1_tag, player2_tag, status)
    select
      NEW.tournament_id,
      1,
      row_number() over (order by r.created_at),
      r.gamer_tag,
      lead(r.gamer_tag) over (order by r.created_at),
      'pending'
    from public.registrations r
    where r.tournament_id = NEW.tournament_id
      and r.payment_status = 'paid'
      and (row_number() over (order by r.created_at)) % 2 = 1;

    -- Notify all participants
    insert into public.notifications (user_id, type, title, message, data)
    select r.user_id,
           'match_ready',
           '🎮 Tournament Started! ' || v_t.name,
           'The tournament is full and has started! Check your Round 1 match now.',
           jsonb_build_object('tournament_id', NEW.tournament_id, 'round', 1)
    from public.registrations r
    where r.tournament_id = NEW.tournament_id and r.payment_status = 'paid';
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_registration_paid on public.registrations;
create trigger on_registration_paid
  after update of payment_status on public.registrations
  for each row execute procedure public.maybe_start_tournament();

-- ── FUNCTION: is_admin helper ─────────────────────────────────────────────────
create or replace function public.is_admin(p_user_id uuid)
returns boolean language sql security definer as $$
  select exists(
    select 1 from public.admin_roles where user_id = p_user_id
  ) or exists(
    select 1 from public.profiles where id = p_user_id and is_admin = true
  );
$$;

-- ── PLATFORM FEE TRACKING ─────────────────────────────────────────────────────
create table if not exists public.platform_revenue (
  id              uuid default gen_random_uuid() primary key,
  created_at      timestamptz default now() not null,
  tournament_id   uuid references public.tournaments(id) on delete set null,
  amount_kes      int not null,
  type            text not null default 'platform_fee',  -- platform_fee|withdrawal_fee
  description     text
);
alter table public.platform_revenue enable row level security;
-- Only admins can read revenue (enforced at API level via service role)

-- ── INDEXES for performance ────────────────────────────────────────────────────
create index if not exists idx_wallets_user          on public.wallets(user_id);
create index if not exists idx_wallet_tx_user        on public.wallet_transactions(user_id, created_at desc);
create index if not exists idx_payout_status         on public.payout_queue(status, created_at);
create index if not exists idx_notif_queue_status    on public.notification_queue(status, created_at);
create index if not exists idx_matches_tournament_round on public.matches(tournament_id, round);
create index if not exists idx_registrations_tournament on public.registrations(tournament_id, payment_status);
