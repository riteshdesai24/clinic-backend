const router = require('express').Router();
const controller = require('../controllers/dentaltreatment.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// ========================
// CREATE TREATMENT TYPE
// ========================
router.post(
  '/',
  protect,
  allowRoles('ADMIN', 'STAFF'),
  controller.create
);

// ========================
// LIST TREATMENT TYPES
// ========================
router.get(
  '/',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.getAll
);

// ========================
// GET TREATMENT TYPE BY ID
// ========================
router.get(
  '/:id',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.getById
);

// ========================
// UPDATE TREATMENT TYPE
// ========================
router.put(
  '/:id',
  protect,
  allowRoles('ADMIN', 'STAFF'),
  controller.update
);

// ========================
// DELETE TREATMENT TYPE
// ========================
router.delete(
  '/:id',
  protect,
  allowRoles('ADMIN'),
  controller.remove
);

module.exports = router;
