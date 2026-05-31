// utils/sendSMS.js
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

module.exports = async ({ to, message }) => {
  return client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to: `+91${to}` // adjust country code as needed
  });
};