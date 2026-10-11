const twilio = require('twilio');

const normalizePhoneNumber = value => {
  const phone = String(value || '').trim().replace(/[\s().-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(phone)) return phone;
  if (/^\d{10}$/.test(phone)) return `+91${phone}`;
  if (/^91\d{10}$/.test(phone)) return `+${phone}`;
  throw new Error('WhatsApp phone number must be E.164 or a 10-digit Indian number');
};

module.exports = async ({ to, body, mediaUrl }) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    throw new Error('WhatsApp delivery is not configured');
  }
  if (!mediaUrl) throw new Error('A public invoice PDF URL is required for WhatsApp delivery');

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${normalizePhoneNumber(to)}`,
    body,
    mediaUrl: [mediaUrl]
  });
};
