const router = require('express').Router();

const doctorCtrl = require('../controllers/doctor.controller');
const User = require('../models/User');
const attachmentUpload = require('../middlewares/attachmentUpload');
const createAttachmentController = require('../controllers/recordAttachment.controller');
const { protect, allowRoles } = require('../middlewares/auth');

const Doctor = {
  findOne: (query) => User.findOne({ ...query, role: 'DOCTOR' })
};
const attachments = createAttachmentController(Doctor, 'doctor');

// Login required
router.use(protect);

// ADMIN + STAFF + DOCTOR can create / update
router.post('/', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.create);
router.put('/:id', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.update);
router.delete('/:id', allowRoles('ADMIN'), doctorCtrl.remove);

// ADMIN + STAFF + DOCTOR can view
router.get('/autocomplete', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.autocomplete);
router.post('/:id/attachments', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachmentUpload, attachments.upload);
router.get('/:id/attachments', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.list);
router.get('/:id/attachments/:attachmentId', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.download);
router.get('/:id/attachments/:attachmentId/preview', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.preview);
router.delete('/:id/attachments/:attachmentId', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.remove);
router.get('/', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.list);
router.get('/:id', allowRoles('ADMIN', 'STAFF', 'DOCTOR'), doctorCtrl.getById);

module.exports = router;
