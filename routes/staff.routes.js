const router = require('express').Router();
const controller = require('../controllers/staff.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// ========================
// CREATE STAFF
// ========================
router.post(
  '/',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.createStaff
);

// ========================
// LIST STAFF
// ========================
router.get(
  '/autocomplete',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.autocomplete
);

router.get(
  '/',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.listStaff
);

// ========================
// GET STAFF BY ID (View / Edit)
// ========================
router.get(
  '/:id',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.getStaffById
);

// ========================
// UPDATE STAFF
// ========================
router.put(
  '/:id',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.updateStaff
);

// ========================
// DELETE STAFF
// ========================
router.delete(
  '/:id',
  protect,
  allowRoles('ADMIN'),
  controller.deleteStaff
);

module.exports = router;
