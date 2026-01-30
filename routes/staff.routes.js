
const router = require('express').Router();
const controller = require('../controllers/staff.controller');
const { protect, allowRoles } = require('../middlewares/auth');

router.post('/', protect, allowRoles('ADMIN'), controller.createStaff);
router.get('/', protect, allowRoles('ADMIN'), controller.listStaff);

module.exports = router;
