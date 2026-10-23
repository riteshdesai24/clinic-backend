const router = require('express').Router();
const controller = require('./super-admin.controller');
const { protect } = require('./super-admin.middleware');
const { authLimiter } = require('../middlewares/rateLimiter');
const excelUpload = require('./excel-upload.middleware');

router.post('/register', authLimiter, controller.register);
router.post('/login', authLimiter, controller.login);
// Keep the frontend's existing /api/superadmin/auth/* URLs working as well.
router.post('/auth/register', authLimiter, controller.register);
router.post('/auth/login', authLimiter, controller.login);

router.use(protect);
router.get('/clinics', controller.listClinics);
router.post('/clinics', controller.createClinic);
router.put('/clinics/:id', controller.updateClinic);
router.delete('/clinics/:id', controller.deleteClinic);

router.get('/memberships', controller.listMemberships);
router.post('/memberships', controller.createMembership);
router.put('/memberships/:id', controller.updateMembership);
router.delete('/memberships/:id', controller.deleteMembership);

router.get('/treatments', controller.listTreatments);
router.post('/treatments', controller.createTreatment);
router.put('/treatments/:id', controller.updateTreatment);
router.delete('/treatments/:id', controller.deleteTreatment);

router.get('/labs', controller.listLabs);
router.post('/labs', controller.createLab);
router.put('/labs/:id', controller.updateLab);
router.delete('/labs/:id', controller.deleteLab);

router.get('/imports/excel/:resource/template', controller.downloadExcelTemplate);
router.post('/imports/excel/:resource', excelUpload, controller.importExcel);

router.get('/:type(countries|states|cities)', controller.listMaster);
router.post('/:type(countries|states|cities)', controller.createMaster);
router.put('/:type(countries|states|cities)/:id', controller.updateMaster);
router.delete('/:type(countries|states|cities)/:id', controller.deleteMaster);

module.exports = router;
