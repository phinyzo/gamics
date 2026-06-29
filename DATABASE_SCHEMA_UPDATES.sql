-- ─────────────────────────────────────────────────────────────────────────────
-- M-Pesa Daraja Direct Integration — Database Schema Updates
-- PhinTech Arena | PhinTech Solutions, Kenya
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ADD MPESA CHECKOUT ID COLUMNS ───────────────────────────────────────────
-- Required to track STK Push transactions and query their status

-- 1. Add to wallet_transactions table
ALTER TABLE wallet_transactions 
ADD COLUMN IF NOT EXISTS mpesa_checkout_id TEXT,
ADD COLUMN IF NOT EXISTS mpesa_code TEXT;

COMMENT ON COLUMN wallet_transactions.mpesa_checkout_id IS 'M-Pesa Daraja CheckoutRequestID from STK Push response';
COMMENT ON COLUMN wallet_transactions.mpesa_code IS 'M-Pesa receipt number (e.g., SA12345678)';

-- 2. Add to registrations table (tournament registration payments)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS mpesa_checkout_id TEXT;

COMMENT ON COLUMN registrations.mpesa_checkout_id IS 'M-Pesa Daraja CheckoutRequestID from STK Push response';

-- ── ADD INDEXES FOR PERFORMANCE ─────────────────────────────────────────────

-- Index on mpesa_checkout_id for fast callback lookups
CREATE INDEX IF NOT EXISTS idx_wallet_tx_checkout 
ON wallet_transactions(mpesa_checkout_id) 
WHERE mpesa_checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_checkout 
ON registrations(mpesa_checkout_id) 
WHERE mpesa_checkout_id IS NOT NULL;

-- Index on mpesa_code for duplicate detection
CREATE INDEX IF NOT EXISTS idx_wallet_tx_mpesa_code 
ON wallet_transactions(mpesa_code) 
WHERE mpesa_code IS NOT NULL;

-- ── MIGRATION NOTES ──────────────────────────────────────────────────────────

-- Run this SQL in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor
-- No data loss — only adds new columns (existing rows will have NULL values)
-- Backward compatible — old Lipia Online transactions still work

-- ── VERIFICATION QUERIES ─────────────────────────────────────────────────────

-- Check if columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'wallet_transactions' 
  AND column_name IN ('mpesa_checkout_id', 'mpesa_code');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'registrations' 
  AND column_name = 'mpesa_checkout_id';

-- Check recent transactions
SELECT 
  id, 
  user_id, 
  type, 
  amount_kes, 
  status, 
  ref, 
  mpesa_checkout_id, 
  mpesa_code,
  created_at
FROM wallet_transactions
ORDER BY created_at DESC
LIMIT 10;
