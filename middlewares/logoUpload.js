const multer = require('multer');
const path = require('path');

const allowedTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes[extension] !== file.mimetype) {
      return callback(new Error('Logo must be a JPG, PNG, or WebP image'));
    }
    return callback(null, true);
  }
}).single('logo');

module.exports = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      message: tooLarge ? 'Logo must be 5 MB or smaller' : error.message
    });
  });
};
