const mongoose = require('mongoose');
const Attachment = require('../models/Attachment');
const logger = require('../utils/logger');

const attachmentData = (attachment) => ({
  id: attachment._id,
  originalName: attachment.originalName,
  contentType: attachment.contentType,
  size: attachment.size,
  uploadedBy: attachment.uploadedBy,
  createdAt: attachment.createdAt
});

module.exports = (RecordModel, recordType) => {
  const findRecord = (req) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return null;
    return RecordModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  };
  const attachmentUrl = (recordId, attachmentId) => {
    const resource = recordType === 'appointment' ? 'appointments'
      : recordType === 'patient' ? 'patients'
        : recordType === 'doctor' ? 'doctors' : 'treatments';
    return `/api/${resource}/${recordId}/attachments/${attachmentId}`;
  };

  return {
    upload: async (req, res) => {
      try {
        const record = await findRecord(req);
        if (!record) {
          return res.status(mongoose.Types.ObjectId.isValid(req.params.id) ? 404 : 400).json({
            success: false,
            message: mongoose.Types.ObjectId.isValid(req.params.id) ? 'Record not found' : 'Invalid record ID'
          });
        }

        if (!req.files?.length) {
          return res.status(400).json({ success: false, message: 'Select at least one file using the files field' });
        }

        const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
        if (fileName && req.files.length !== 1) {
          return res.status(400).json({ success: false, message: 'The fileName field can only be used when uploading one file' });
        }
        if (fileName && (!fileName.replace(/[\r\n\0]/g, '').trim() || fileName.length > 255)) {
          return res.status(400).json({ success: false, message: 'fileName must be between 1 and 255 characters' });
        }

        const attachments = await Attachment.insertMany(req.files.map((file) => ({
          clinicId: req.clinicId,
          recordType,
          recordId: record._id,
          originalName: (fileName || file.originalname).replace(/[\r\n\0]/g, '').slice(0, 255),
          contentType: file.mimetype,
          size: file.size,
          uploadedBy: req.user._id,
          content: file.buffer
        })));

        return res.status(201).json({
          success: true,
          count: attachments.length,
          data: attachments.map((attachment) => ({
            ...attachmentData(attachment),
            downloadUrl: attachmentUrl(record._id, attachment._id),
            previewUrl: `${attachmentUrl(record._id, attachment._id)}/preview`
          }))
        });
      } catch (err) {
        logger.error(`Upload ${recordType} attachment error`, { error: err.message, stack: err.stack });
        return res.status(500).json({ success: false, message: 'Unable to upload attachments' });
      }
    },

    list: async (req, res) => {
      try {
        const record = await findRecord(req);
        if (!record) {
          return res.status(mongoose.Types.ObjectId.isValid(req.params.id) ? 404 : 400).json({
            success: false,
            message: mongoose.Types.ObjectId.isValid(req.params.id) ? 'Record not found' : 'Invalid record ID'
          });
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const query = {
          clinicId: req.clinicId,
          recordType,
          recordId: record._id
        };
        const [attachments, count] = await Promise.all([
          Attachment.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
          Attachment.countDocuments(query)
        ]);

        return res.json({
          success: true,
          page,
          limit,
          count,
          totalPages: Math.ceil(count / limit),
          data: attachments.map((attachment) => ({
            ...attachmentData(attachment),
            downloadUrl: attachmentUrl(record._id, attachment._id),
            previewUrl: `${attachmentUrl(record._id, attachment._id)}/preview`
          }))
        });
      } catch (err) {
        logger.error(`List ${recordType} attachments error`, { error: err.message, stack: err.stack });
        return res.status(500).json({ success: false, message: 'Unable to list attachments' });
      }
    },

    download: async (req, res) => {
      try {
        const record = await findRecord(req);
        if (!record) {
          return res.status(mongoose.Types.ObjectId.isValid(req.params.id) ? 404 : 400).json({
            success: false,
            message: mongoose.Types.ObjectId.isValid(req.params.id) ? 'Record not found' : 'Invalid record ID'
          });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.attachmentId)) {
          return res.status(400).json({ success: false, message: 'Invalid attachment ID' });
        }

        const attachment = await Attachment.findOne({
          _id: req.params.attachmentId,
          clinicId: req.clinicId,
          recordType,
          recordId: record._id
        }).select('+content');

        if (!attachment) {
          return res.status(404).json({ success: false, message: 'Attachment not found' });
        }

        const safeName = attachment.originalName.replace(/["\\\r\n]/g, '_');
        res.set('Content-Type', attachment.contentType);
        res.set('Content-Length', attachment.size);
        res.set('Content-Disposition', `attachment; filename="${safeName}"`);
        res.set('X-Content-Type-Options', 'nosniff');
        return res.send(attachment.content);
      } catch (err) {
        logger.error(`Download ${recordType} attachment error`, { error: err.message, stack: err.stack });
        return res.status(500).json({ success: false, message: 'Unable to download attachment' });
      }
    },

    preview: async (req, res) => {
      try {
        const record = await findRecord(req);
        if (!record) {
          return res.status(mongoose.Types.ObjectId.isValid(req.params.id) ? 404 : 400).json({
            success: false,
            message: mongoose.Types.ObjectId.isValid(req.params.id) ? 'Record not found' : 'Invalid record ID'
          });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.attachmentId)) {
          return res.status(400).json({ success: false, message: 'Invalid attachment ID' });
        }

        const attachment = await Attachment.findOne({
          _id: req.params.attachmentId,
          clinicId: req.clinicId,
          recordType,
          recordId: record._id
        }).select('+content');
        if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found' });

        const safeName = attachment.originalName.replace(/["\\\r\n]/g, '_');
        res.set('Content-Type', attachment.contentType);
        res.set('Content-Length', attachment.size);
        res.set('Content-Disposition', `inline; filename="${safeName}"`);
        res.set('X-Content-Type-Options', 'nosniff');
        return res.send(attachment.content);
      } catch (err) {
        logger.error(`Preview ${recordType} attachment error`, { error: err.message, stack: err.stack });
        return res.status(500).json({ success: false, message: 'Unable to preview attachment' });
      }
    },

    remove: async (req, res) => {
      try {
        const record = await findRecord(req);
        if (!record) {
          return res.status(mongoose.Types.ObjectId.isValid(req.params.id) ? 404 : 400).json({
            success: false,
            message: mongoose.Types.ObjectId.isValid(req.params.id) ? 'Record not found' : 'Invalid record ID'
          });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.attachmentId)) {
          return res.status(400).json({ success: false, message: 'Invalid attachment ID' });
        }

        const result = await Attachment.findOneAndDelete({
          _id: req.params.attachmentId,
          clinicId: req.clinicId,
          recordType,
          recordId: record._id
        });

        if (!result) {
          return res.status(404).json({ success: false, message: 'Attachment not found' });
        }

        return res.json({ success: true, message: 'Attachment deleted successfully' });
      } catch (err) {
        logger.error(`Delete ${recordType} attachment error`, { error: err.message, stack: err.stack });
        return res.status(500).json({ success: false, message: 'Unable to delete attachment' });
      }
    }
  };
};
