const router = require('express').Router();

const doctorCtrl = require('../controllers/doctor.controller');
const { protect, allowRoles } = require('../middlewares/auth');

// Login required
router.use(protect);

// ADMIN + STAFF + DOCTOR can create / update
router.post('/', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.create);
router.put('/:id', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.update);
router.delete('/:id', allowRoles('ADMIN'), doctorCtrl.remove);

// ADMIN + STAFF + DOCTOR can view
router.get('/', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.list);
router.get('/:id', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.getById);

module.exports = router;
