# Debug: No STK Push Received

## Current Status

✅ **Frontend Working** - Shows success message with phone number and ref  
❌ **Backend Issue** - STK Push not reaching your phone (+254114565176)  
❌ **JavaScript Error** - `loadWalletData is not defined` (fixed, redeploying)

## Most Likely Cause

The M-Pesa Daraja API authentication is still failing because the Vercel environment variables still contain newlines. The frontend shows success because it doesn't know the backend failed.

## Immediate Actions

### 1. Check Vercel Deployment Logs (CRITICAL)

Go to: https://vercel.com/phins-projects-1947c904/phintech-gamics/logs

Look for the most recent deployment and search for:
- `[mpesa-daraja]`
- `OAuth`
- `STK Push`
- `wallet`

**What to Look For:**

**✅ SUCCESS - If you see this:**
```
[mpesa-daraja] DEBUG OAuth attempt:
  - Environment: production
  - OAuth URL: https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
  - Consumer Key length: 48 first 4 chars: P5K0
  - Consumer Secret length: 64 first 4 chars: DyGp
  - Consumer Key has newlines? false
  - Consumer Secret has newlines? false
[mpesa-daraja] OAuth SUCCESS - token received
[mpesa-daraja] STK Push initiated: ws_CO_290620260000000000 WALLET-FE4E7524-1782795307810
```
→ M-Pesa is working, issue is somewhere else

**❌ FAILURE - If you see this:**
```
[mpesa-daraja] DEBUG OAuth attempt:
  - Consumer Key has newlines? true  ← PROBLEM!
[mpesa-daraja] OAuth FAILED:
  - Status: 400
  - Data: { error: "invalid_client" }
[wallet] STK Push failed: Failed to authenticate with M-Pesa Daraja API
```
→ Environment variables STILL have newlines

### 2. Verify Environment Variables (If Auth Failing)

Go to: https://vercel.com/phins-projects-1947c904/phintech-gamics/settings/environment-variables

**For EACH of these 6 variables:**
1. Click to view the value
2. **Check if there are any extra spaces or line breaks**
3. If you see ANY whitespace before/after the value, **DELETE and recreate** the variable

**The 6 Variables:**
```
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET  
MPESA_PASSKEY
MPESA_SHORTCODE
MPESA_ENVIRONMENT
MPESA_CALLBACK_URL
```

**How to Fix (Vercel Dashboard Method):**

For example, `MPESA_CONSUMER_KEY`:

1. Delete the existing variable
2. Click "Add New"
3. Name: `MPESA_CONSUMER_KEY`
4. Value: Copy EXACTLY from here (select text carefully, no extra spaces):
   ```
   P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw
   ```
5. Environment: Production
6. Save

Repeat for all 6 variables using values from `MPESA_FIX_INSTRUCTIONS.md`

### 3. Alternative: Test with Sandbox Credentials

If production keeps failing, test with sandbox first to verify the integration works:

**Change in Vercel Dashboard:**
- `MPESA_ENVIRONMENT` = `sandbox` (instead of production)
- Use sandbox credentials from Safaricom Daraja sandbox portal

This will help isolate whether the issue is:
- ❌ Environment variable corruption (would fail in both)
- ❌ Production credentials issue (would work in sandbox)
- ❌ Something else

### 4. Check M-Pesa Daraja Portal

Go to: https://developer.safaricom.co.ke/MyApps

**Verify:**
1. ✅ App status is "Live/Production"
2. ✅ Shortcode 4501895 is correctly linked
3. ✅ "Lipa Na M-Pesa Online" product is activated
4. ✅ Credentials match what you entered in Vercel

**Common Issues:**
- App not yet approved for production
- Shortcode not linked to the app
- Wrong credentials copied (extra characters, typos)

### 5. Check Phone Number Format

The phone number being sent: `+254114565176`

**Verify:**
- ✅ Is this the correct M-Pesa registered number?
- ✅ Is the phone on and has network?
- ✅ Try with a different phone number to rule out number-specific issues

## Test Sequence

**Once you've fixed environment variables:**

1. **Redeploy** (automatic after env var changes, or run `vercel --prod`)
2. **Wait 2 minutes** for deployment
3. **Try deposit again** - KES 10
4. **Immediately check Vercel logs** - Look for debug output
5. **Check your phone** - Should receive STK Push within 5-10 seconds

## Expected Success Flow

```
User clicks Deposit
  ↓
Frontend sends request to /api/wallet?action=deposit
  ↓
Backend normalizes phone: +254114565176 → 254114565176
  ↓
Backend calls M-Pesa OAuth (should succeed now)
  ↓
Backend calls M-Pesa STK Push API
  ↓
M-Pesa sends STK Push to phone 254114565176
  ↓
User enters PIN on phone
  ↓
M-Pesa calls back /api/mpesa-callback
  ↓
Wallet balance updates
```

## Still Not Working?

### Check These:

1. **Callback URL accessibility**
   - Test: https://gamics.vercel.app/api/mpesa-callback
   - Should return error (it expects POST), but shouldn't 404
   - Must be publicly accessible (not localhost)

2. **Database transaction record**
   - Log into Supabase: https://supabase.com/dashboard/project/zwehmnytyelyzcdyibzg
   - Open SQL Editor
   - Run: 
     ```sql
     SELECT * FROM wallet_transactions 
     WHERE ref = 'WALLET-FE4E7524-1782795307810' 
     ORDER BY created_at DESC;
     ```
   - Should show pending transaction
   - Check `mpesa_checkout_id` - should have a value if STK Push succeeded

3. **M-Pesa Test Transaction**
   - Use M-Pesa's test transaction flow in their portal
   - Or try with KES 1 if available (minimum amount)

## Quick Win: Enable More Debug Logging

If still stuck, we can add more logging to see exactly what M-Pesa returns.

## Summary

**Most Likely Issue:** Environment variables in Vercel still have newlines/whitespace

**Solution:** Manually re-enter all 6 M-Pesa variables in Vercel dashboard

**Verification:** Check Vercel deployment logs for `[mpesa-daraja] OAuth SUCCESS`
