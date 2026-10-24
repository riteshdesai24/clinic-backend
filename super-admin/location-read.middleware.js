const jwt = require('jsonwebtoken');
const clinicAuth = require('../middlewares/auth');
const superAdminAuth = require('./super-admin.middleware').protect;

const clinicRoleCheck = clinicAuth.allowRoles('ADMIN', 'STAFF', 'DOCTOR');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';
  const decoded = token ? jwt.decode(token) : null;

  if (decoded?.role === 'SUPER_ADMIN') return superAdminAuth(req, res, next);

  return clinicAuth.protect(req, res, () => clinicRoleCheck(req, res, next));
};
