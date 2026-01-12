const Plan = require('../models/Plan');

/**
 * =====================================================
 * CREATE PLAN
 * =====================================================
 */
exports.create = async (req, res) => {
  try {
    const plan = await Plan.create(req.body);

    return res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Create Plan Error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Plan already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * LIST PLANS
 * =====================================================
 */
exports.list = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 });

    return res.json({
      success: true,
      message: 'Plans fetched successfully',
      data: plans
    });
  } catch (error) {
    console.error('List Plan Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * GET PLAN DETAIL
 * =====================================================
 */
exports.getById = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    return res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Get Plan Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * UPDATE PLAN
 * =====================================================
 */
exports.update = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    return res.json({
      success: true,
      message: 'Plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Update Plan Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * DELETE PLAN
 * =====================================================
 */
exports.remove = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    return res.json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete Plan Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
