const jwt = require('jsonwebtoken');
const SuperAdmin = require('./models/SuperAdmin');

exports.protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'SUPER_ADMIN' || !decoded.userId) {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }
    const admin = await SuperAdmin.findById(decoded.userId);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Super admin account is unavailable' });
    }
    req.superAdmin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
