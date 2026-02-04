const router = require('express').Router();

const doctorCtrl = require('../controllers/doctor.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// Login required
router.use(protect);

// Only ADMIN
router.post('/', allowRoles('ADMIN'), doctorCtrl.create);
router.put('/:id', allowRoles('ADMIN'), doctorCtrl.update);
router.delete('/:id', allowRoles('ADMIN'), doctorCtrl.remove);

// ADMIN + STAFF
router.get('/', allowRoles('ADMIN', 'STAFF'), doctorCtrl.list);
router.get('/:id', allowRoles('ADMIN', 'STAFF'), doctorCtrl.getById);

module.exports = router;
