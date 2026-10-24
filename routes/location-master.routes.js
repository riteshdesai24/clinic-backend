const router = require('express').Router();
const { protect, allowRoles } = require('../middlewares/auth');
const controller = require('../super-admin/super-admin.controller');

router.use(protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'));

router.get('/countries/autocomplete', controller.autocompleteCountries);
router.get('/:type(countries|states|cities)', controller.listMaster);

module.exports = router;
