# M-Pesa Authentication Fix Instructions

## Problem Identified

The M-Pesa Daraja API authentication is failing because the environment variables in Vercel contain literal newline characters (`\r\n`, `\nn\r\n`). This happened when the PowerShell script added them via CLI.

## What Was Fixed in Code

✅ **Local .env.production cleaned** - Removed newline characters  
✅ **Debug logging added** - `api/lib/mpesa-daraja.js` now logs OAuth attempts  
✅ **Failed transactions hidden** - UI now filters out failed transactions  
✅ **Transaction status indicators** - Pending transactions show ⏳ badge  
✅ **Environment variable trimming** - All env vars use `.trim()` (backup defense)

## What You Need to Do

### Option 1: Use Vercel Dashboard (RECOMMENDED)

1. Go to: https://vercel.com/phins-projects-1947c904/phintech-gamics/settings/environment-variables

2. **Delete** these 6 environment variables:
   - `MPESA_CONSUMER_KEY`
   - `MPESA_CONSUMER_SECRET`
   - `MPESA_PASSKEY`
   - `MPESA_SHORTCODE`
   - `MPESA_ENVIRONMENT`
   - `MPESA_CALLBACK_URL`

3. **Add them back** manually with these exact values (copy-paste carefully):

   ```
   Variable: MPESA_CONSUMER_KEY
   Value: P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw
   Environment: Production
   ```

   ```
   Variable: MPESA_CONSUMER_SECRET
   Value: DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v
   Environment: Production
   ```

   ```
   Variable: MPESA_PASSKEY
   Value: 9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8
   Environment: Production
   ```

   ```
   Variable: MPESA_SHORTCODE
   Value: 4501895
   Environment: Production
   ```

   ```
   Variable: MPESA_ENVIRONMENT
   Value: production
   Environment: Production
   ```

   ```
   Variable: MPESA_CALLBACK_URL
   Value: https://gamics.vercel.app/api/mpesa-callback
   Environment: Production
   ```

4. **Redeploy** - Vercel will automatically redeploy, or trigger manually:
   ```powershell
   vercel --prod
   ```

### Option 2: Use Vercel CLI with Input Files

If you prefer CLI, use this method:

1. For each variable, create a temporary text file with the value (no newlines)
2. Use: `cat value.txt | vercel env add VARIABLE_NAME production`

But the dashboard is more reliable and visual.

## Verification Steps

After redeploying:

1. **Check Deployment Logs** in Vercel dashboard
   - Look for: `[mpesa-daraja] DEBUG OAuth attempt:`
   - Should show: `Consumer Key length: 48` and `Consumer Secret length: 64`
   - Should NOT show: `has newlines? true`

2. **Test Deposit** on https://gamics.vercel.app
   - Try depositing KES 10
   - Should see: "Check your phone and enter M-Pesa PIN"
   - Should NOT see: "Failed to authenticate with M-Pesa Daraja API"

3. **Check Transaction History**
   - Failed transactions should no longer appear in the list
   - Pending transactions should show ⏳ Pending badge

## Debug Output to Watch For

When you attempt a deposit after fixing, check Vercel logs for:

```
[mpesa-daraja] DEBUG OAuth attempt:
  - Environment: production
  - OAuth URL: https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
  - Consumer Key length: 48 first 4 chars: P5K0
  - Consumer Secret length: 64 first 4 chars: DyGp
  - Consumer Key has newlines? false
  - Consumer Secret has newlines? false
[mpesa-daraja] OAuth SUCCESS - token received
[mpesa-daraja] STK Push initiated: ws_CO_290620260000000000 WALLET-FE4E7524-123456789
```

## What Happens Next

Once environment variables are clean:
- ✅ OAuth will succeed
- ✅ STK Push will be sent to customer's phone
- ✅ Customer enters PIN on phone
- ✅ M-Pesa calls back your API: `/api/mpesa-callback`
- ✅ Wallet balance updates automatically
- ✅ Transaction shows as "completed" in history

## Files Changed

- `api/lib/mpesa-daraja.js` - Added debug logging, trimmed env vars
- `api/wallet.js` - Already marks failed transactions as "failed"
- `assets/js/admin.js` - Filter failed transactions from UI
- `.env.production` - Cleaned newlines (local reference only)

## Need Help?

If authentication still fails after fixing env vars:
1. Check Vercel deployment logs
2. Share the debug output (first 4 chars of credentials are safe to share)
3. Verify credentials in M-Pesa Daraja portal: https://developer.safaricom.co.ke/MyApps
