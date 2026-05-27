const router = require('express').Router();
const controller = require('../controllers/attendance.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// ========================
// STAFF / DOCTOR — Self-service
// ========================

// Clock in (today)
router.post(
  '/clock-in',
  protect,
  allowRoles('STAFF', 'DOCTOR'),
  controller.clockIn
);

// Clock out (today)
router.post(
  '/clock-out',
  protect,
  allowRoles('STAFF', 'DOCTOR'),
  controller.clockOut
);

// My today's status
router.get(
  '/me/today',
  protect,
  allowRoles('STAFF', 'DOCTOR'),
  controller.getTodayStatus
);

// My attendance history (supports ?from=&to=&cursor=&limit=)
router.get(
  '/me',
  protect,
  allowRoles('STAFF', 'DOCTOR'),
  controller.getMyAttendance
);

// ========================
// ADMIN — Management
// ========================

// Summary report (supports ?staffId=&from=&to=)
router.get(
  '/summary',
  protect,
  allowRoles('ADMIN'),
  controller.getAttendanceSummary
);

// List all attendance records (supports ?staffId=&date=&from=&to=&status=&cursor=&limit=)
router.get(
  '/',
  protect,
  allowRoles('ADMIN'),
  controller.listAttendance
);

// Manually mark / override attendance
router.post(
  '/mark',
  protect,
  allowRoles('ADMIN'),
  controller.markAttendance
);

// Delete a record
router.delete(
  '/:id',
  protect,
  allowRoles('ADMIN'),
  controller.deleteAttendance
);

module.exports = router;
