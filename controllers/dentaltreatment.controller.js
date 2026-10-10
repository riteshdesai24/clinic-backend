const TreatmentType = require('../models/TreatmentType');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ─── Create Treatment Master ────────────────────────────────────────────────

exports.create = async (req, res) => {
  try {
    const { name, description, duration, price, status } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'name is required'
      });
    }

    if (price !== undefined && price !== null && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({
        success: false,
        message: 'price must be a non-negative number'
      });
    }

    // ✅ Validate duration if provided
    if (duration !== undefined && duration !== null) {
      if (typeof duration !== 'number' || duration < 0) {
        return res.status(400).json({
          success: false,
          message: 'duration must be a non-negative number (in minutes)'
        });
      }
    }

    const clinicId = req.clinicId;

    const treatmentMaster = await TreatmentType.create({
      clinicId,
      name: name.trim(),
      description: description?.trim(),
      duration,
      price,
      status: status || 'ACTIVE'
    });

    logger.info(`Treatment Master created: ${treatmentMaster._id}`);

    return res.status(201).json({
      success: true,
      message: 'Treatment Master created successfully',
      data: treatmentMaster
    });

  } catch (err) {
    logger.error('Create Treatment Master Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── List Treatment Masters ──────────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status
    } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    // ✅ Always scoped to clinic
    const clinicId = req.clinicId;
    const query = { clinicId };

    if (status) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [data, count] = await Promise.all([
      TreatmentType.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageLimit)
        .limit(pageLimit),
      TreatmentType.countDocuments(query)
    ]);

    return res.json({
      success: true,
      page: pageNum,
      limit: pageLimit,
      totalPages: Math.ceil(count / pageLimit),
      count,
      data
    });

  } catch (err) {
    logger.error('List Treatment Masters Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get Treatment Master By ID ──────────────────────────────────────────────

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid treatment ID' });
    }

    const treatmentMaster = await TreatmentType.findOne({
      _id: id,
      clinicId: req.clinicId // ✅ clinic-scoped
    });

    if (!treatmentMaster) {
      return res.status(404).json({ success: false, message: 'Treatment Master not found' });
    }

    return res.json({ success: true, data: treatmentMaster });

  } catch (err) {
    logger.error('Get Treatment Master Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Treatment Master ─────────────────────────────────────────────────

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid treatment ID' });
    }

    // ✅ Prevent clinicId from being changed
    const { clinicId, ...safeUpdates } = req.body;

    // ✅ Validate price if provided
    if (safeUpdates.price !== undefined) {
      if (typeof safeUpdates.price !== 'number' || safeUpdates.price < 0) {
        return res.status(400).json({
          success: false,
          message: 'price must be a non-negative number'
        });
      }
    }

    // ✅ Validate duration if provided
    if (safeUpdates.duration !== undefined && safeUpdates.duration !== null) {
      if (typeof safeUpdates.duration !== 'number' || safeUpdates.duration < 0) {
        return res.status(400).json({
          success: false,
          message: 'duration must be a non-negative number (in minutes)'
        });
      }
    }

    // ✅ Validate status if provided
    if (safeUpdates.status) {
      if (!['ACTIVE', 'INACTIVE'].includes(safeUpdates.status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }
    }

    if (safeUpdates.name) safeUpdates.name = safeUpdates.name.trim();
    if (safeUpdates.description) safeUpdates.description = safeUpdates.description.trim();

    const treatmentMaster = await TreatmentType.findOneAndUpdate(
      { _id: id, clinicId: req.clinicId },
      safeUpdates,
      { new: true, runValidators: true }
    );

    if (!treatmentMaster) {
      return res.status(404).json({ success: false, message: 'Treatment Master not found' });
    }

    logger.info(`Treatment Master updated: ${id} by user: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Treatment Master updated successfully',
      data: treatmentMaster
    });

  } catch (err) {
    logger.error('Update Treatment Master Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete Treatment Master ─────────────────────────────────────────────────

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid treatment ID' });
    }

    const treatmentMaster = await TreatmentType.findOneAndDelete({
      _id: id,
      clinicId: req.clinicId // ✅ clinic-scoped
    });

    if (!treatmentMaster) {
      return res.status(404).json({ success: false, message: 'Treatment Master not found' });
    }

    logger.info(`Treatment Master deleted: ${id} by user: ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Treatment Master deleted successfully'
    });

  } catch (err) {
    logger.error('Delete Treatment Master Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
