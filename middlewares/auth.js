const jwt = require('jsonwebtoken');

/**
 * ============================
 * AUTH PROTECT MIDDLEWARE
 * ============================
 */
exports.protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.clinicId = decoded.clinicId;
    req.role = decoded.role;

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * ============================
 * ROLE BASED ACCESS
 * ============================
 */
exports.allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    return next();
  };
};
