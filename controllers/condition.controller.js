const mongoose = require('mongoose');
const Condition = require('../models/Condition');

const types = ['MEDICAL', 'DENTAL'];
const statuses = ['ACTIVE', 'INACTIVE'];

exports.create = async (req, res) => {
  try {
    const { name, description, type, status } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: 'name and type are required' });
    if (!types.includes(type)) return res.status(400).json({ success: false, message: 'Invalid condition type' });
    if (status && !statuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const condition = await Condition.create({
      clinicId: req.clinicId, name: name.trim(), description: description?.trim(), type, status: status || 'ACTIVE'
    });
    return res.status(201).json({ success: true, data: condition });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A condition with this name already exists' });
    return res.status(500).json({ success: false, message: 'Unable to create condition' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const query = { clinicId: req.clinicId };
    if (req.query.type) {
      if (!types.includes(req.query.type)) return res.status(400).json({ success: false, message: 'Invalid condition type' });
      query.type = req.query.type;
    }
    if (req.query.status) query.status = req.query.status;
    const [data, count] = await Promise.all([
      Condition.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Condition.countDocuments(query)
    ]);
    return res.json({
      success: true,
      page,
      limit,
      count,
      totalPages: Math.ceil(count / limit),
      data
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to load conditions' });
  }
};

exports.getById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid condition ID' });
    const condition = await Condition.findOne({ _id: req.params.id, clinicId: req.clinicId });
    if (!condition) return res.status(404).json({ success: false, message: 'Condition not found' });
    return res.json({ success: true, data: condition });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to load condition' });
  }
};

exports.update = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid condition ID' });
    const { name, description, status } = req.body;
    if (status && !statuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const updates = { ...(name !== undefined && { name: name.trim() }), ...(description !== undefined && { description: description.trim() }), ...(status && { status }) };
    const condition = await Condition.findOneAndUpdate({ _id: req.params.id, clinicId: req.clinicId }, updates, { new: true, runValidators: true });
    if (!condition) return res.status(404).json({ success: false, message: 'Condition not found' });
    return res.json({ success: true, data: condition });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A condition with this name already exists' });
    return res.status(500).json({ success: false, message: 'Unable to update condition' });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid condition ID' });
    const condition = await Condition.findOneAndDelete({ _id: req.params.id, clinicId: req.clinicId });
    if (!condition) return res.status(404).json({ success: false, message: 'Condition not found' });
    return res.json({ success: true, message: 'Condition deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to delete condition' });
  }
};
