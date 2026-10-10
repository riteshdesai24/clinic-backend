const router = require('express').Router();
const controller = require('../controllers/profile.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', controller.getCurrent);
router.put('/', controller.updateCurrent);
router.delete('/', controller.deactivateCurrent);

module.exports = router;