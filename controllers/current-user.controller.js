const User = require('../models/User');

exports.getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    let clinic;

    if (user.role === 'ADMIN') {
      clinic = {
        _id: user._id,
        clinicName: user.clinicName,
        plan: user.plan,
        planActivatedAt: user.planActivatedAt,
        planExpiresAt: user.planExpiresAt
      };
    } else {
      const clinicAdmin = user.clinicId
        ? await User.findById(user.clinicId).select('clinicName plan planActivatedAt planExpiresAt email phone')
        : null;
      clinic = {
        _id: user.clinicId,
        clinicName: clinicAdmin?.clinicName,
        plan: clinicAdmin?.plan,
        planActivatedAt: clinicAdmin?.planActivatedAt,
        planExpiresAt: clinicAdmin?.planExpiresAt
      };
    }

    return res.json({
      success: true,
      message: 'User data fetched successfully',
      clinic,
      user: user.toObject()
    });
  } catch (error) {
    console.error('Get Current User Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
