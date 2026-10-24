const User = require('../models/User');
const clinicApiResponse = require('../utils/clinicApiResponse');

exports.getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    const clinicOwnerId = user.role === 'ADMIN' ? user._id : user.clinicId;
    const clinicOwner = user.role === 'ADMIN'
      ? user
      : (clinicOwnerId
        ? await User.findById(clinicOwnerId).select(
          'clinicName plan planActivatedAt planExpiresAt phone email address1 address2 address3 country countryId state stateId city cityId pincode +logoContentType +logoContent'
        )
        : null);
    const logoOwner = clinicOwnerId
      ? await User.findById(clinicOwnerId).select('+logoContentType +logoContent')
      : null;

    return res.json(clinicApiResponse({
      user,
      clinicOwner,
      logoOwner,
      message: 'Profile loaded successfully'
    }));
  } catch (error) {
    console.error('Get Current User Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
