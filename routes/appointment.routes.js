const r = require('express').Router();
const c = require('../controllers/appointment.controller');
const Appointment = require('../models/Appointment');
const attachmentUpload = require('../middlewares/attachmentUpload');
const createAttachmentController = require('../controllers/recordAttachment.controller');
const { protect, allowRoles } = require('../middlewares/auth');
const attachments = createAttachmentController(Appointment, 'appointment');

r.post('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.create);   // Create
r.get('/calendar', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getCalendar);
r.post('/:id/attachments', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachmentUpload, attachments.upload);
r.get('/:id/attachments', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.list);
r.get('/:id/attachments/:attachmentId', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.download);
r.delete('/:id/attachments/:attachmentId', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), attachments.remove);
r.get('/', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getAll);   // List
r.get('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getById);  // Detail  ← must stay after r.get('/')
r.put('/:id', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.update);   // Update
r.delete('/:id', protect, allowRoles('ADMIN'), c.remove); // Soft-delete (cancel)

module.exports = r;