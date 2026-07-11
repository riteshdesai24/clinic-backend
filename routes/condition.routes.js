const router = require('express').Router();
const controller = require('../controllers/condition.controller');
const { protect, allowRoles } = require('../middlewares/auth');

router.get('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.getAll);
router.get('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), controller.getById);
router.post('/', protect, allowRoles('ADMIN', 'STAFF'), controller.create);
router.put('/:id', protect, allowRoles('ADMIN', 'STAFF'), controller.update);
router.delete('/:id', protect, allowRoles('ADMIN'), controller.remove);

module.exports = router;
