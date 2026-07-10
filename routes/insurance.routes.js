const r = require('express').Router();
const multer = require('multer');
const c = require('../controllers/insurance.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Create insurance
r.post('/', c.create);

// Import insurances from CSV / XLSX
r.post('/import', upload.single('file'), c.importFile);

// List insurances
r.get('/', c.list);

// Insurance detail
r.get('/:id', c.getById);

// Update insurance
r.put('/:id', c.update);

// Delete insurance
r.delete('/:id', c.remove);

module.exports = r;
