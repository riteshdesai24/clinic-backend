const User = require('../models/User');

const addMonths = (date, months) => {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
};

module.exports = async (payment, paymentId, activatedAt = new Date()) => {
  if (payment.status !== 'SUCCESS') {
    payment.status = 'SUCCESS';
    payment.paymentId = paymentId || payment.paymentId;
    payment.activatedAt = activatedAt;
    payment.durationMonths = payment.durationMonths || 1;
    payment.expiresAt = addMonths(payment.activatedAt, payment.durationMonths);
    await payment.save();
  } else if (!payment.activatedAt || !payment.expiresAt) {
    payment.paymentId = payment.paymentId || paymentId;
    payment.activatedAt = payment.activatedAt || payment.createdAt || activatedAt;
    payment.durationMonths = payment.durationMonths || 1;
    payment.expiresAt = payment.expiresAt || addMonths(payment.activatedAt, payment.durationMonths);
    await payment.save();
  } else if (!payment.paymentId && paymentId) {
    payment.paymentId = paymentId;
    await payment.save();
  }

  const user = await User.findOneAndUpdate(
    { _id: payment.clinicId, role: 'ADMIN' },
    {
      $set: {
        plan: payment.plan,
        planActivatedAt: payment.activatedAt,
        planExpiresAt: payment.expiresAt
      }
    },
    { new: true, runValidators: true }
  );

  if (!user) throw new Error(`Clinic admin not found for payment ${payment.orderId}`);
  return { payment, user };
};
