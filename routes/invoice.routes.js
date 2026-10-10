const router = require('express').Router();
const controller = require('../controllers/invoice.controller');
const { protect, allowRoles } = require('../middlewares/auth');

router.use(protect);
router.get('/dashboard/summary', allowRoles('ADMIN', 'DOCTOR'), controller.dashboardSummary);
router.get('/', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.list);
router.post('/', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.create);
router.post('/:id/payments', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.addPayment);
module.exports = router;
