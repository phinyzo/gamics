-- ============================================================
-- PhinTech Arena — Seed Data
-- Kenyan tournaments for launch
-- ============================================================

-- Insert seed tournaments (pending_approval = false so they show publicly)
INSERT INTO public.tournaments (id, name, game, format, max_players, entry_fee, prize_pool, platform, status, start_date, rules, host_name, host_contact, pending_approval)
VALUES
  (gen_random_uuid(), 'Nairobi PES Cup Season 1',        'PES / eFootball', 'single',      16,  100,  1200, 'PS5',   'open',      '2026-06-15', '2×5 min halves. No custom tactics exploits. Screenshot required.',           'PhinTech Solutions', '+254700000000', false),
  (gen_random_uuid(), 'EA FC 25 Weekly — KES 200',       'FIFA / EA FC',    'single',       8,  200,  1200, 'PS5',   'ongoing',   '2026-06-10', 'Professional difficulty. Ultimate Team enabled.',                            'ArenaKE',            '+254711000001', false),
  (gen_random_uuid(), 'Tekken 8 Nairobi Open',           'Tekken 8',        'double',      16,  500,  6000, 'PS5',   'open',      '2026-06-20', 'Best of 3 sets. FT2 rounds. No DLC characters in first week.',               'KE_FGC',             '+254722000002', false),
  (gen_random_uuid(), 'CoD Warzone Duos — KES 1,000',    'Call of Duty',    'roundrobin',  32, 1000, 25000, 'PC',    'open',      '2026-06-25', 'Duos only. Drop Verdansk. Highest kills + placement score wins.',             'PhinTech Arena',     '+254733000003', false),
  (gen_random_uuid(), 'Mortal Kombat 1 — Fatality Cup',  'Mortal Kombat 1', 'single',       8,  100,   600, 'PS5',   'completed', '2026-05-30', 'Best of 3. Stage select on.',                                               'MK_KenyaCrew',       '+254744000004', false),
  (gen_random_uuid(), 'NBA 2K Nairobi League',           'NBA 2K',          'roundrobin',  16,  200,  2400, 'PS5',   'open',      '2026-06-18', 'Current gen rosters. No cheese plays. Sportsmanship required.',              'Hoop_KE',            '+254755000005', false),
  (gen_random_uuid(), 'Street Fighter 6 Weekend Warrior','Street Fighter 6','single',       8,  100,   600, 'PS5',   'open',      '2026-06-21', 'Best of 3. All characters allowed.',                                        'SF_Nairobi',         '+254766000006', false);

-- Seed leaderboard with sample Kenyan players
INSERT INTO public.leaderboard (gamer_tag, game, elo, wins, losses, prize_won) VALUES
  ('Phin_KE',      'PES / eFootball', 1682, 12, 3,  2400),
  ('Brian254',     'PES / eFootball', 1645,  9, 4,  1200),
  ('NairobiFC',    'PES / eFootball', 1621,  8, 5,   600),
  ('KE_Striker',   'PES / eFootball', 1598,  7, 6,     0),
  ('ZedGamer',     'PES / eFootball', 1575,  6, 7,     0),
  ('EAFC_Phin',    'FIFA / EA FC',    1710, 15, 2,  3600),
  ('Mombasa_FC',   'FIFA / EA FC',    1648, 10, 5,  1200),
  ('Kisumu_Pro',   'FIFA / EA FC',    1612,  8, 7,     0),
  ('Kazuya_KE',    'Tekken 8',        1590,  5, 2,     0),
  ('Law_NRB',      'Tekken 8',        1565,  4, 3,     0),
  ('Scorpion_KE',  'Mortal Kombat 1', 1720, 18, 1,  4800),
  ('Liu_KE',       'Mortal Kombat 1', 1655, 12, 4,  1800),
  ('Shang_NRB',    'Mortal Kombat 1', 1618,  9, 6,   600)
ON CONFLICT (gamer_tag, game) DO NOTHING;
