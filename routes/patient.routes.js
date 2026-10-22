const r = require('express').Router();
const c = require('../controllers/patient.controller');
const { protect, allowRoles } = require('../middlewares/auth');
const Patient = require('../models/Patient');
const attachmentUpload = require('../middlewares/attachmentUpload');
const createAttachmentController = require('../controllers/recordAttachment.controller');
const attachments = createAttachmentController(Patient, 'patient');

r.post('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.create);
r.get('/autocomplete', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.autocomplete);
r.post('/:id/attachments', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachmentUpload, attachments.upload);
r.get('/:id/attachments', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.list);
r.get('/:id/attachments/:attachmentId', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.download);
r.get('/:id/attachments/:attachmentId/preview', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.preview);
r.delete('/:id/attachments/:attachmentId', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.remove);
r.get('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getAll);
r.get('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getById);
r.put('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.update);
r.delete('/:id', protect, allowRoles('ADMIN'), c.remove);

module.exports = r;
