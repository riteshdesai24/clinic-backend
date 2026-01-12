const Treatment = require('../models/Treatment');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');

/**
 * =====================================================
 * CREATE TREATMENT
 * =====================================================
 */
exports.create = async (req, res) => {
  try {
    const { patientId, description, appointmentId } = req.body;

    if (!patientId || !description) {
      return res.status(400).json({
        success: false,
        message: 'patientId and description are required'
      });
    }

    const treatment = await Treatment.create({
      ...req.body,
      clinicId: req.clinicId
    });

    // Optional: mark appointment completed
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        status: 'COMPLETED'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Treatment created successfully',
      data: treatment
    });
  } catch (error) {
    console.error('Create Treatment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * LIST TREATMENTS
 * Filters + Cursor Pagination
 * =====================================================
 */
exports.list = async (req, res) => {
  try {
    const {
      cursor,
      limit = 10,
      patientId,
      appointmentId,
      doctorId,
      sort = 'desc'
    } = req.query;

    const query = { clinicId: req.clinicId };

    if (patientId) query.patientId = new mongoose.Types.ObjectId(patientId);
    if (appointmentId) query.appointmentId = new mongoose.Types.ObjectId(appointmentId);
    if (doctorId) query.doctorId = new mongoose.Types.ObjectId(doctorId);

    if (cursor) {
      query._id =
        sort === 'asc'
          ? { $gt: new mongoose.Types.ObjectId(cursor) }
          : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pageLimit = parseInt(limit);

    const treatments = await Treatment.find(query)
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1)
      .populate('patientId', 'name phone gender')
      .populate('doctorId', 'name')
      .populate('appointmentId', 'startTime endTime status');

    const hasNextPage = treatments.length > pageLimit;
    if (hasNextPage) treatments.pop();

    const nextCursor =
      treatments.length > 0
        ? treatments[treatments.length - 1]._id
        : null;

    return res.json({
      success: true,
      count: treatments.length,
      hasNextPage,
      nextCursor,
      data: treatments
    });
  } catch (error) {
    console.error('List Treatments Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * GET TREATMENT DETAIL
 * =====================================================
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const treatment = await Treatment.findOne({
      _id: id,
      clinicId: req.clinicId
    })
      .populate('patientId', 'name phone gender age')
      .populate('doctorId', 'name')
      .populate('appointmentId', 'startTime endTime status');

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    return res.json({
      success: true,
      data: treatment
    });
  } catch (error) {
    console.error('Get Treatment Detail Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * UPDATE TREATMENT
 * =====================================================
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const treatment = await Treatment.findOneAndUpdate(
      { _id: id, clinicId: req.clinicId },
      req.body,
      { new: true, runValidators: true }
    )
      .populate('patientId', 'name phone gender')
      .populate('doctorId', 'name')
      .populate('appointmentId', 'startTime endTime status');

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    return res.json({
      success: true,
      message: 'Treatment updated successfully',
      data: treatment
    });
  } catch (error) {
    console.error('Update Treatment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * DELETE TREATMENT
 * =====================================================
 */
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const treatment = await Treatment.findOneAndDelete({
      _id: id,
      clinicId: req.clinicId
    });

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    return res.json({
      success: true,
      message: 'Treatment deleted successfully'
    });
  } catch (error) {
    console.error('Delete Treatment Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
