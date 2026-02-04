const jwt = require('jsonwebtoken');

/**
 * ============================
 * AUTH PROTECT
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

    // ✅ Attach everything in one place
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      clinicId: decoded.clinicId
    };

    // optional shortcut (if you like)
    req.clinicId = decoded.clinicId;

    next();

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

    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    next();
  };
};
