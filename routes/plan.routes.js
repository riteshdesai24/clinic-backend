
const r = require('express').Router();
const c = require('../controllers/plan.controller');
r.post('/',c.create);
r.put('/:id',c.update);
r.delete('/:id',c.remove);
r.get('/',c.list);
module.exports = r;
