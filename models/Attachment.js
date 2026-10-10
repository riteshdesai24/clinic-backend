const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    recordType: {
      type: String,
      enum: ['appointment', 'treatment'],
      required: true
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    originalName: {
      type: String,
      required: true,
      maxlength: 255
    },
    contentType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true,
      min: 1
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: Buffer,
      required: true,
      select: false
    }
  },
  { timestamps: true }
);

AttachmentSchema.index({ clinicId: 1, recordType: 1, recordId: 1 });

module.exports = mongoose.model('Attachment', AttachmentSchema);