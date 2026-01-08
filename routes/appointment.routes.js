
const r = require('express').Router();
const c = require('../controllers/appointment.controller');
const { protect } = require('../middlewares/auth');
r.post('/',protect,c.create);
r.get('/',protect,c.list);
module.exports = r;
