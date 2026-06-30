/**
 * Shared Supabase client for Vercel API routes
 * Powered by PhinTech Solutions, Kenya
 */

const { createClient } = require('@supabase/supabase-js');

function getServiceClient() {
  const url    = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function getAnonClient() {
  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anon);
}

// Extract bearer token from Authorization header
function getBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// Get authenticated user from request token
async function getUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const client = getAnonClient();
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Standard CORS headers
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Normalise any Kenyan phone number format to 254XXXXXXXXX (no +).
 *
 * Accepts:
 *   07XXXXXXXX   → 2547XXXXXXXX  (Safaricom)
 *   01XXXXXXXX   → 2541XXXXXXXX  (Airtel Kenya)
 *   7XXXXXXXX    → 2547XXXXXXXX
 *   1XXXXXXXX    → 2541XXXXXXXX
 *   2547XXXXXXXX → unchanged
 *   2541XXXXXXXX → unchanged
 *   +2547XXXXXXXX → 2547XXXXXXXX
 *   +254110XXXXXX → 254110XXXXXX (Telkom - 0110 prefix)
 *   +254111XXXXXX → 254111XXXXXX (Safaricom - 0111 prefix)
 *   +254112-119   → All valid prefixes
 *
 * Returns null if the number cannot be normalised to a valid 12-digit KE number.
 */
function normalizeKEPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[\s\-().+]/g, '');  // strip spaces, dashes, parens, plus

  let normalized;

  // Handle 10-digit numbers starting with 07 (Safaricom)
  if (/^07\d{8}$/.test(digits)) {
    // 07XXXXXXXX → 2547XXXXXXXX
    normalized = '254' + digits.slice(1);
  }
  // Handle 10-digit numbers starting with 01 (Airtel - old format)
  else if (/^01[0-9]\d{7}$/.test(digits)) {
    // 010XXXXXXX, 011XXXXXXX, 012XXXXXXX, etc. → 254 + rest
    normalized = '254' + digits.slice(1);
  }
  // Handle 9-digit numbers starting with 7 (no leading 0)
  else if (/^7\d{8}$/.test(digits)) {
    // 7XXXXXXXX → 2547XXXXXXXX
    normalized = '254' + digits;
  }
  // Handle 9-digit numbers starting with 1 (no leading 0)
  else if (/^1\d{8}$/.test(digits)) {
    // 1XXXXXXXX → 2541XXXXXXXX
    normalized = '254' + digits;
  }
  // Handle 254 prefixed numbers (already normalized)
  else if (/^254[0-9]\d{8}$/.test(digits)) {
    // Already in correct format: 2547XXXXXXXX, 2541XXXXXXXX, 254110XXXXXX, etc.
    normalized = digits;
  }
  // Handle +254 format
  else if (/^\+254[0-9]\d{8}$/.test(raw)) {
    normalized = raw.slice(1); // Remove the +
  }
  else {
    console.warn('[normalizeKEPhone] Invalid format:', raw, '→ digits:', digits);
    return null;
  }

  // Final validation: must be exactly 12 digits starting with 254
  if (!/^254\d{9}$/.test(normalized)) {
    console.warn('[normalizeKEPhone] Final validation failed:', normalized);
    return null;
  }
  
  console.log('[normalizeKEPhone] Success:', raw, '→', normalized);
  return normalized;
}

module.exports = { getServiceClient, getAnonClient, getUser, setCors, getBearerToken, normalizeKEPhone };
