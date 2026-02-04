const router = require('express').Router();
const controller = require('../controllers/staff.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// ========================
// CREATE STAFF
// ========================
router.post(
  '/',
  protect,
  allowRoles('ADMIN'),
  controller.createStaff
);

// ========================
// LIST STAFF
// ========================
router.get(
  '/',
  protect,
  allowRoles('ADMIN'),
  controller.listStaff
);

// ========================
// GET STAFF BY ID (View / Edit)
// ========================
router.get(
  '/:id',
  protect,
  allowRoles('ADMIN'),
  controller.getStaffById
);

// ========================
// UPDATE STAFF
// ========================
router.put(
  '/:id',
  protect,
  allowRoles('ADMIN'),
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
