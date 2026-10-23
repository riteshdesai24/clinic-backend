const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

module.exports = (req, res, next) => upload.single('file')(req, res, (error) => {
  if (error) return res.status(400).json({
    success: false,
    message: error.code === 'LIMIT_FILE_SIZE' ? 'Excel file must be 10 MB or smaller' : error.message
  });
  next();
});
