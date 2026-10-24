const PROFILE_FIELDS = ['phone', 'email', 'address1', 'address2', 'address3', 'country', 'countryId', 'state', 'stateId', 'city', 'cityId', 'pincode'];

const toObject = (value) => value?.toObject ? value.toObject() : value || {};

const dataUrlFor = (user) => user?.logoContent && user?.logoContentType
  ? `data:${user.logoContentType};base64,${user.logoContent.toString('base64')}`
  : null;

const safeUserData = (user, logoUrl) => {
  const {
    password, resetPasswordToken, resetPasswordExpire, logoContent, logoContentType,
    ...safeUser
  } = toObject(user);
  return { ...safeUser, logoUrl: logoUrl || null };
};

const clinicData = (clinicOwner, logoOwner) => {
  if (!clinicOwner) return null;
  const clinic = toObject(clinicOwner);
  return {
    _id: clinic._id,
    clinicName: clinic.clinicName,
    plan: clinic.plan,
    planActivatedAt: clinic.planActivatedAt,
    planExpiresAt: clinic.planExpiresAt,
    logoUrl: dataUrlFor(logoOwner),
    ...Object.fromEntries(PROFILE_FIELDS.map((field) => [field, clinic[field]]))
  };
};

module.exports = ({ user, clinicOwner, logoOwner, token = null, message }) => {
  const logoUrl = dataUrlFor(logoOwner);
  const userData = safeUserData(user, logoUrl);
  return {
    success: true,
    message,
    token: token || null,
    clinic: clinicData(clinicOwner, logoOwner),
    user: userData,
    data: userData
  };
};
