/**
 * Test endpoint to validate phone number formatting
 * Access: /api/test-phone?phone=YOUR_NUMBER
 */
const { normalizeKEPhone } = require('./_supabase');

module.exports = async function handler(req, res) {
  const phone = req.query.phone;
  
  if (!phone) {
    return res.status(400).json({ 
      error: 'Provide phone number as query param: /api/test-phone?phone=0712345678' 
    });
  }

  const normalized = normalizeKEPhone(phone);
  
  return res.status(200).json({
    input: phone,
    normalized: normalized,
    valid: !!normalized,
    explanation: normalized 
      ? `✅ Valid - Will be sent to M-Pesa as: ${normalized}`
      : `❌ Invalid - Phone number doesn't match Kenyan format. Use: 07XXXXXXXX, 01XXXXXXXX, or +254XXXXXXXXX`,
    examples: {
      safaricom: '0712345678 → 254712345678',
      airtel: '0100123456 → 254100123456',
      telkom: '0770123456 → 254770123456',
    }
  });
};
