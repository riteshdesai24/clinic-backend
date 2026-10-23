const router = require('express').Router();
const controller = require('../controllers/staff.controller');
const currentUserController = require('../controllers/current-user.controller');
const { protect, allowRoles } = require('../middlewares/auth');

router.use(protect);

router.get('/me', currentUserController.getCurrentUser);
router.post('/', allowRoles('ADMIN'), controller.createStaff);
router.get('/autocomplete', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.autocomplete);
router.get('/', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.listStaff);
router.get('/:id', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.getStaffById);
router.put('/:id', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.updateStaff);
router.delete('/:id', allowRoles('ADMIN'), controller.deleteStaff);

module.exports = router;
