# M-Pesa Daraja API Service Documentation

## Overview

Direct integration with Safaricom's M-Pesa Daraja API for production-ready payments.

**Credentials:** App `Prod-PHINTECH SOLUTIONS-1782745321201`  
**Shortcode:** 4501895  
**Environment:** Production

---

## File Structure

```
api/
├── mpesa-daraja.js      ← Core M-Pesa service (OAuth, STK Push, B2C)
├── mpesa-callback.js    ← Handles payment callbacks from Daraja
├── wallet.js            ← Wallet deposits/withdrawals (uses mpesa-daraja.js)
├── register.js          ← Tournament registration payments (uses mpesa-daraja.js)
└── _supabase.js         ← Database + auth utilities
```

---

## API Endpoints

### 1. **POST /api/wallet?action=deposit**
Initiate wallet deposit via STK Push

**Request:**
```json
{
  "amount": 500,
  "phone": "0712345678"
}
```

**Response:**
```json
{
  "success": true,
  "checkoutRequestID": "ws_CO_12062026123456789",
  "ref": "WALLET-ABC-1719654321",
  "message": "Check your phone (254712345678) and enter M-Pesa PIN to complete payment of KES 500."
}
```

**Flow:**
1. User calls endpoint with amount + phone
2. Backend calls `stkPush()` → User receives STK prompt
3. User enters M-Pesa PIN on phone
4. M-Pesa calls `/api/mpesa-callback` with result
5. Backend credits wallet if `ResultCode === 0`

---

### 2. **POST /api/register**
Register for tournament + initiate payment

**Request:**
```json
{
  "tournament_id": "t1",
  "gamer_tag": "Phin_KE",
  "phone": "0712345678"
}
```

**Response:**
```json
{
  "registration": { "id": "reg123", "payment_status": "pending", ... },
  "checkoutRequestID": "ws_CO_12062026123456789",
  "message": "STK Push sent to 254712345678. Enter M-Pesa PIN to pay KES 200."
}
```

**Flow:**
1. Backend creates registration with `payment_status=pending`
2. Calls `stkPush()` with tournament entry fee
3. User pays on phone
4. Callback updates registration to `payment_status=paid`
5. User receives in-app + SMS confirmation

---

### 3. **POST /api/mpesa-callback**
Handles M-Pesa Daraja callbacks (internal endpoint, called by Safaricom)

**Daraja Callback Format:**
```json
{
  "Body": {
    "stkCallback": {
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CheckoutRequestID": "ws_CO_12062026123456789",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 500 },
          { "Name": "MpesaReceiptNumber", "Value": "SA12345678" },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}
```

**Actions:**
- `ResultCode === 0` → Payment success → Credit wallet or confirm registration
- `ResultCode !== 0` → Payment failed → Mark transaction as `failed`

**Backward Compatibility:**
Still supports old Lipia Online format for legacy pending transactions.

---

## mpesa-daraja.js Functions

### `getAccessToken()`
Generates OAuth token for Daraja API calls.

**Usage:**
```javascript
const token = await getAccessToken();
```

**Returns:** `string` (access token, valid for 1 hour)

---

### `stkPush(phone, amount, accountRef, description)`
Initiates STK Push (Lipa Na M-Pesa Online).

**Parameters:**
- `phone` (string) — 254XXXXXXXXX format
- `amount` (number) — Amount in KES (minimum 1)
- `accountRef` (string) — Unique reference (e.g., `WALLET-ABC-123`)
- `description` (string, optional) — Transaction description

**Returns:**
```javascript
{
  "MerchantRequestID": "12345-67890-1",
  "CheckoutRequestID": "ws_CO_12062026123456789",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "CustomerMessage": "Success. Request accepted for processing"
}
```

**Example:**
```javascript
const { stkPush } = require('./mpesa-daraja');

const response = await stkPush(
  '254712345678',
  500,
  'WALLET-ABC-123',
  'PhinTech Arena wallet deposit'
);
```

---

### `stkQuery(checkoutRequestID)`
Queries the status of an STK Push transaction.

**Parameters:**
- `checkoutRequestID` (string) — From STK Push response

**Returns:**
```javascript
{
  "ResponseCode": "0",
  "ResultCode": "0",
  "ResultDesc": "The service request is processed successfully.",
  "CheckoutRequestID": "ws_CO_12062026123456789"
}
```

**Example:**
```javascript
const { stkQuery } = require('./mpesa-daraja');
const status = await stkQuery('ws_CO_12062026123456789');

if (status.ResultCode === '0') {
  console.log('Payment successful!');
} else {
  console.log('Payment failed:', status.ResultDesc);
}
```

---

### `b2cPayout(phone, amount, remarks)`
Sends money to customer's M-Pesa wallet (B2C).

**Parameters:**
- `phone` (string) — 254XXXXXXXXX format
- `amount` (number) — Amount in KES
- `remarks` (string, optional) — Transaction remarks

**Returns:**
```javascript
{
  "ConversationID": "AG_20260612_123456789abcdef",
  "OriginatorConversationID": "12345-67890-1",
  "ResponseCode": "0",
  "ResponseDescription": "Accept the service request successfully."
}
```

**Example:**
```javascript
const { b2cPayout } = require('./mpesa-daraja');

await b2cPayout(
  '254712345678',
  500,
  'Tournament winnings - PhinTech Arena'
);
```

**Note:** Requires `MPESA_SECURITY_CREDENTIAL` env var (encrypted initiator password).

---

## Environment Variables

```bash
# M-Pesa Daraja Credentials
MPESA_CONSUMER_KEY=P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw
MPESA_CONSUMER_SECRET=DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v
MPESA_PASSKEY=9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8
MPESA_SHORTCODE=4501895
MPESA_ENVIRONMENT=production  # or 'sandbox' for testing
MPESA_CALLBACK_URL=https://gamics.vercel.app/api/mpesa-callback

# B2C Security Credential (optional, for payouts)
MPESA_SECURITY_CREDENTIAL=your_encrypted_initiator_password
```

Set in Vercel: **Dashboard → Settings → Environment Variables**

---

## Result Codes Reference

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Insufficient balance |
| `1032` | Request cancelled by user |
| `1037` | Timeout (user didn't enter PIN) |
| `2001` | Invalid initiator |
| `500.001.1001` | Invalid phone number |

Full list: https://developer.safaricom.co.ke/Documentation

---

## Testing

### Local Testing
```bash
# Start dev server
vercel dev

# Test STK Push
curl -X POST http://localhost:3000/api/wallet?action=deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"amount": 10, "phone": "254712345678"}'
```

### Production Testing
Use **real money** (minimum KES 1) to test in production:
1. Call `/api/wallet?action=deposit` with KES 10
2. Check phone for STK push
3. Enter M-Pesa PIN
4. Verify wallet is credited in Supabase

---

## Troubleshooting

### Error: "Failed to authenticate with M-Pesa Daraja API"
**Fix:** Check `MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET` are correct.

### Error: "M-Pesa STK Push failed"
**Check:**
- Phone number is 254XXXXXXXXX (not 07XX)
- Amount is at least 1 KES
- Callback URL is HTTPS and whitelisted in Daraja portal

### STK push sent but no callback
**Debug:**
1. Check Vercel logs: `vercel logs --prod`
2. Verify callback URL in Daraja portal matches env var
3. Test callback manually: `curl -X POST https://gamics.vercel.app/api/mpesa-callback -d '{...}'`

---

## Security Best Practices

1. **Never log sensitive data** — Consumer Key/Secret, Passkey
2. **Validate callbacks** — Check `ResultCode` before crediting
3. **Prevent duplicate payments** — Use `CheckoutRequestID` as unique key
4. **Rate limit** — Add rate limiting to payment endpoints
5. **Whitelist IPs** — Consider whitelisting Safaricom IPs for callbacks

---

## Support

- **Daraja Portal:** https://developer.safaricom.co.ke
- **Support Email:** developers@safaricom.co.ke
- **Docs:** https://developer.safaricom.co.ke/APIs

---

**Integration complete! 🚀**
