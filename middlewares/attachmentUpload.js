const multer = require('multer');
const path = require('path');

const allowedTypes = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.txt': ['text/plain']
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes[extension]?.includes(file.mimetype)) {
      return callback(new Error('Unsupported file type'));
    }
    return callback(null, true);
  }
}).array('files', 5);

module.exports = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();

    const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    const status = tooLarge ? 413 : 400;
    return res.status(status).json({
      success: false,
      message: tooLarge ? 'Each file must be 5 MB or smaller' : error.message
    });
  });
};