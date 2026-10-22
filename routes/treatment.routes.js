const r = require('express').Router();
const c = require('../controllers/treatment.controller');
const Treatment = require('../models/Treatment');
const attachmentUpload = require('../middlewares/attachmentUpload');
const createAttachmentController = require('../controllers/recordAttachment.controller');
const { protect, allowRoles } = require('../middlewares/auth');
const attachments = createAttachmentController(Treatment, 'treatment');

// Create
r.post('/', protect, c.create);
r.post('/:id/attachments', protect, attachmentUpload, attachments.upload);
r.get('/:id/attachments', protect, attachments.list);
r.get('/:id/attachments/:attachmentId', protect, attachments.download);
r.get('/:id/attachments/:attachmentId/preview', protect, attachments.preview);
r.delete('/:id/attachments/:attachmentId', protect, attachments.remove);

// List
r.get('/autocomplete', protect, c.autocomplete);
r.get('/', protect, c.getAll);

// Get treatments for a specific doctor (dentist)
r.get('/doctor/:doctorId', protect, allowRoles('ADMIN', 'STAFF', 'DOCTOR'), c.getByDoctor);

// Detail
r.get('/:id', protect, c.getById);

// Update
r.put('/:id', protect, c.update);

// Delete
r.delete('/:id', protect, c.remove);

module.exports = r;
