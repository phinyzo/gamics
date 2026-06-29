# 🚀 M-Pesa Daraja Integration — Deployment Checklist

## Pre-Deployment Checklist

### ✅ Code Changes (Complete)
- [x] Created `api/mpesa-daraja.js` service
- [x] Updated `api/wallet.js` for direct STK Push
- [x] Updated `api/register.js` for tournament payments
- [x] Updated `api/mpesa-callback.js` with Daraja callback handling
- [x] Updated `assets/js/arena.js` frontend payment flow
- [x] Added `axios` to `package.json`
- [x] Updated `.env.example` with M-Pesa credentials
- [x] Created documentation files

### ✅ Documentation (Complete)
- [x] `MPESA_DARAJA_MIGRATION.md` — Migration guide
- [x] `DATABASE_SCHEMA_UPDATES.sql` — Database changes
- [x] `api/README_MPESA.md` — API documentation
- [x] `INTEGRATION_SUMMARY.md` — Integration overview
- [x] `DEPLOYMENT_CHECKLIST.md` — This file

---

## Deployment Steps

### Step 1: Database Migration ⚠️ **CRITICAL**

1. Go to Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor
2. Copy and paste the entire contents of `DATABASE_SCHEMA_UPDATES.sql`
3. Click **Run** to execute the migration
4. Verify columns were added:

```sql
-- Verify wallet_transactions columns
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'wallet_transactions' 
  AND column_name IN ('mpesa_checkout_id', 'mpesa_code');

-- Expected result:
-- mpesa_checkout_id | text
-- mpesa_code        | text

-- Verify registrations column
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'registrations' 
  AND column_name = 'mpesa_checkout_id';

-- Expected result:
-- mpesa_checkout_id | text
```

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### Step 2: Add Environment Variables to Vercel ⚠️ **CRITICAL**

1. Go to: https://vercel.com/dashboard
2. Select your project: **gamics**
3. Navigate to: **Settings → Environment Variables**
4. Add the following variables for **Production** environment:

```env
MPESA_CONSUMER_KEY=P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw
MPESA_CONSUMER_SECRET=DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v
MPESA_PASSKEY=9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8
MPESA_SHORTCODE=4501895
MPESA_ENVIRONMENT=production
MPESA_CALLBACK_URL=https://gamics.vercel.app/api/mpesa-callback
```

5. Click **Save** after adding each variable

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### Step 3: Deploy to Production

#### Option A: Git Push (Recommended)
```bash
# Stage all changes
git add .

# Commit changes
git commit -m "feat: Replace Lipia Online with M-Pesa Daraja direct integration"

# Push to main/master branch
git push origin master
```

Vercel will automatically detect the push and deploy.

#### Option B: Vercel CLI
```bash
# Deploy directly
vercel --prod
```

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### Step 4: Verify Daraja Portal Configuration

1. Go to: https://developer.safaricom.co.ke
2. Login to your account
3. Navigate to: **My Apps → Prod-PHINTECH SOLUTIONS-1782745321201**
4. Verify:
   - **Callback URL** is whitelisted: `https://gamics.vercel.app/api/mpesa-callback`
   - **Shortcode** is: `4501895`
   - **Products enabled:**
     - ✅ Lipa Na M-Pesa Production STK Push
     - ✅ Transaction Status
     - ✅ C2B v2
     - ✅ Reversal
     - ✅ Account Balance
     - ✅ B2C (if planning payouts)

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### Step 5: Test Wallet Deposit (Live Payment) ⚠️ **USE REAL MONEY**

**Minimum test amount: KES 10**

#### Test via API:
```bash
# Get JWT token from Supabase (login first)
# Replace YOUR_JWT_TOKEN with actual token from localStorage/cookies

curl -X POST https://gamics.vercel.app/api/wallet?action=deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"amount": 10, "phone": "0712345678"}'

# Expected response:
{
  "success": true,
  "checkoutRequestID": "ws_CO_29062026XXXXXX",
  "ref": "WALLET-XXXXXXXX-1719654321",
  "message": "Check your phone (254712345678) and enter M-Pesa PIN..."
}
```

#### Test via Frontend:
1. Login to https://gamics.vercel.app
2. Navigate to wallet page
3. Click "Deposit"
4. Enter amount: **10**
5. Enter phone: **0712345678**
6. Click "Deposit"
7. **Check your phone** for STK Push prompt
8. Enter M-Pesa PIN
9. Wait for confirmation (should take 10-30 seconds)

#### Verification:
1. Check Supabase `wallet_transactions` table:
   - New row with `status=completed`
   - `mpesa_checkout_id` populated
   - `mpesa_code` populated (e.g., SA12345678)
2. Check wallet balance is credited
3. Check for SMS notification
4. Check Vercel logs: `vercel logs --prod`
   - Look for: `[mpesa-callback] Payment success: SA12345678 WALLET-ABC-123 KES 10`

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Test Result:** 
- Transaction ID: _______________
- M-Pesa Code: _______________
- Amount: KES _______________
- Status: ⬜ Success | ⬜ Failed

---

### Step 6: Test Tournament Registration Payment

1. Login to https://gamics.vercel.app
2. Navigate to a tournament (e.g., "Nairobi PES Cup")
3. Click "Register"
4. Fill in:
   - Gamer Tag: **TestPlayer_KE**
   - Phone: **0712345678**
   - Platform: **PS5**
   - County: **Nairobi**
5. Click "Register & Pay"
6. **Check your phone** for STK Push prompt
7. Enter M-Pesa PIN
8. Wait for confirmation

#### Verification:
1. Check Supabase `registrations` table:
   - New row with `payment_status=paid`
   - `mpesa_checkout_id` populated
   - `mpesa_code` populated
2. Check for SMS confirmation
3. Check in-app notification
4. Verify player appears in tournament roster

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Test Result:**
- Tournament: _______________
- Registration ID: _______________
- M-Pesa Code: _______________
- Status: ⬜ Success | ⬜ Failed

---

### Step 7: Monitor Callback Logs (24 Hours)

```bash
# Watch logs in real-time
vercel logs --prod --follow

# Filter for M-Pesa callbacks
vercel logs --prod | grep "mpesa-callback"

# Look for successful payments:
# [mpesa-callback] Payment success: SA12345678 WALLET-ABC-123 KES 500
# [mpesa-callback] Registration confirmed: reg123 for TestPlayer_KE

# Look for failures:
# [mpesa-callback] Payment failed: User cancelled transaction WALLET-ABC-123
```

**Monitor for:**
- ✅ Successful callbacks
- ⚠️ Timeout errors (user didn't enter PIN)
- ❌ Failed payments (insufficient balance, etc.)
- 🐛 Unexpected errors

**Status:** ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### Step 8: Backup & Rollback Plan

#### Create Backup
```bash
# Tag current production version
git tag -a v1.0-daraja-integration -m "M-Pesa Daraja integration deployed"
git push origin v1.0-daraja-integration
```

#### Rollback Plan (If Issues)
```bash
# Option 1: Revert to previous commit
git revert HEAD
git push origin master

# Option 2: Rollback in Vercel Dashboard
# Go to: Deployments → Select previous deployment → Promote to Production
```

**Backup Created:** ⬜ Yes | ⬜ No

---

## Post-Deployment Checklist

### Day 1 (Launch Day)
- [ ] Monitor callback logs every 2 hours
- [ ] Test at least 3 wallet deposits
- [ ] Test at least 2 tournament registrations
- [ ] Verify SMS notifications are sent
- [ ] Check Supabase for correct data storage
- [ ] Monitor Vercel function execution time
- [ ] Check for any errors in Vercel dashboard

### Week 1
- [ ] Analyze transaction success rate
- [ ] Monitor callback response times
- [ ] Check for duplicate payment issues
- [ ] Verify referral bonuses are awarded correctly
- [ ] Test manual till payment flow (`action=deposit_till`)
- [ ] Review user feedback

### Month 1
- [ ] Calculate actual M-Pesa fees vs. Lipia Online
- [ ] Plan B2C payout implementation
- [ ] Consider adding Transaction Status query
- [ ] Review error logs for patterns
- [ ] Optimize callback handling if needed

---

## Troubleshooting Guide

### Issue: "Failed to authenticate with M-Pesa Daraja API"
**Solution:**
1. Check `MPESA_CONSUMER_KEY` in Vercel env vars
2. Check `MPESA_CONSUMER_SECRET` in Vercel env vars
3. Verify credentials match Daraja portal
4. Redeploy: `vercel --prod`

### Issue: "M-Pesa STK Push failed"
**Solution:**
1. Check phone number format (should be 254XXXXXXXXX)
2. Verify `MPESA_SHORTCODE=4501895` in env vars
3. Check Daraja portal for IP whitelisting
4. Verify callback URL is HTTPS

### Issue: STK Push sent but no callback received
**Solution:**
1. Check Vercel logs: `vercel logs --prod`
2. Verify `MPESA_CALLBACK_URL` env var
3. Test callback manually:
```bash
curl -X POST https://gamics.vercel.app/api/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{"Body":{"stkCallback":{"ResultCode":0,"CheckoutRequestID":"test123"}}}'
```
4. Check Daraja portal for whitelisted callback URLs

### Issue: User says "Didn't receive STK push"
**Solution:**
1. Verify phone has network coverage
2. Check M-Pesa app is installed
3. Verify phone number was correct (check logs)
4. Try querying transaction status (implement `stkQuery()`)

### Issue: Payment succeeded but wallet not credited
**Solution:**
1. Check `wallet_transactions` table for status
2. Check Vercel logs for callback errors
3. Verify RPC function `credit_wallet` is working
4. Manually credit wallet if needed:
```sql
SELECT credit_wallet(
  'user_id_here',
  500, -- amount
  'deposit',
  'Manual credit after callback failure',
  'SA12345678' -- M-Pesa code
);
```

---

## Success Criteria

### Technical Success
- [x] Code deployed without errors
- [ ] Database migration completed
- [ ] Environment variables configured
- [ ] Test payments succeeded (wallet + tournament)
- [ ] Callbacks received and processed correctly
- [ ] No errors in logs for 24 hours

### Business Success
- [ ] Transaction fees reduced (3% vs 5%)
- [ ] Payment success rate ≥ 95%
- [ ] Average callback time < 30 seconds
- [ ] Zero duplicate payment issues
- [ ] Positive user feedback

### Future Readiness
- [x] B2C payout foundation ready
- [x] Transaction status query ready
- [x] Reversal API ready
- [x] Multi-site support ready

---

## Contact & Support

### Daraja Support
- **Portal:** https://developer.safaricom.co.ke
- **Email:** developers@safaricom.co.ke
- **Phone:** +254 722 000 000

### Vercel Support
- **Dashboard:** https://vercel.com/dashboard
- **Docs:** https://vercel.com/docs

### Supabase Support
- **Dashboard:** https://supabase.com/dashboard
- **Docs:** https://supabase.com/docs

---

## Sign-Off

**Deployed By:** ___________________  
**Date:** ___________________  
**Production URL:** https://gamics.vercel.app  
**Daraja App:** Prod-PHINTECH SOLUTIONS-1782745321201  
**Shortcode:** 4501895  

**Deployment Status:** ⬜ Success | ⬜ Partial | ⬜ Failed

**Notes:**
____________________________________________________________
____________________________________________________________
____________________________________________________________

---

**🎉 Ready to go live! Good luck with your deployment!**
