const router = require('express').Router();
const controller = require('../controllers/dentaltreatment.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// ========================
// CREATE TREATMENT MASTER
// ========================
router.post(
  '/',
  protect,
  allowRoles('ADMIN', 'STAFF'),
  controller.create
);

// ========================
// LIST TREATMENT MASTERS
// ========================
router.get(
  '/',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.getAll
);

// ========================
// GET TREATMENT MASTER BY ID
// ========================
router.get(
  '/:id',
  protect,
  allowRoles('ADMIN', 'STAFF', 'DOCTOR'),
  controller.getById
);

// ========================
// UPDATE TREATMENT MASTER
// ========================
router.put(
  '/:id',
  protect,
  allowRoles('ADMIN', 'STAFF'),
  controller.update
);

// ========================
// DELETE TREATMENT MASTER
// ========================
router.delete(
  '/:id',
  protect,
  allowRoles('ADMIN'),
  controller.remove
);

module.exports = router;
