const router = require('express').Router();
const controller = require('../controllers/profile.controller');
const locationController = require('../controllers/location.controller');
const { protect, allowRoles } = require('../middlewares/auth');
const logoUpload = require('../middlewares/logoUpload');

router.use(protect);

router.get('/', controller.getCurrent);
router.get('/locations/countries', locationController.countries);
router.get('/locations/states', locationController.states);
router.get('/locations/cities', locationController.cities);
router.put('/', logoUpload, controller.updateCurrent);
router.delete('/', controller.deactivateCurrent);
router.put('/logo', allowRoles('ADMIN'), logoUpload, controller.updateLogo);
router.get('/logo', controller.getLogo);
router.delete('/logo', allowRoles('ADMIN'), controller.deleteLogo);

module.exports = router;
