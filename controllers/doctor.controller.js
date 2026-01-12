const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');

/**
 * =====================================================
 * CREATE DOCTOR
 * =====================================================
 */
exports.create = async (req, res) => {
  try {
    const doctor = await Doctor.create({
      ...req.body,
      clinicId: req.clinicId
    });

    return res.status(201).json({
      success: true,
      message: 'Doctor created successfully',
      data: doctor
    });
  } catch (error) {
    console.error('Create Doctor Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * LIST DOCTORS
 * Filters + Sorting + Cursor Pagination
 * =====================================================
 */
exports.list = async (req, res) => {
  try {
    const {
      cursor,
      limit = 10,
      specialization,
      search,
      active,
      sort = 'asc'
    } = req.query;

    const query = { clinicId: req.clinicId };

    // ---- Filters ----
    if (specialization) {
      query.specialization = { $regex: specialization, $options: 'i' };
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (active !== undefined) {
      query.active = active === 'true';
    }

    // ---- Cursor pagination ----
    if (cursor) {
      query._id =
        sort === 'asc'
          ? { $gt: new mongoose.Types.ObjectId(cursor) }
          : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pageLimit = parseInt(limit);

    const doctors = await Doctor.find(query)
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1);

    const hasNextPage = doctors.length > pageLimit;
    if (hasNextPage) doctors.pop();

    const nextCursor =
      doctors.length > 0
        ? doctors[doctors.length - 1]._id
        : null;

    return res.json({
      success: true,
      count: doctors.length,
      hasNextPage,
      nextCursor,
      data: doctors
    });
  } catch (error) {
    console.error('List Doctors Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * DOCTOR DETAIL
 * Doctor + Appointment Count
 * =====================================================
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findOne({
      _id: id,
      clinicId: req.clinicId
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const [total, completed, pending] = await Promise.all([
      Appointment.countDocuments({
        clinicId: req.clinicId,
        doctorId: doctor._id
      }),
      Appointment.countDocuments({
        clinicId: req.clinicId,
        doctorId: doctor._id,
        status: 'COMPLETED'
      }),
      Appointment.countDocuments({
        clinicId: req.clinicId,
        doctorId: doctor._id,
        status: 'PENDING'
      })
    ]);

    return res.json({
      success: true,
      data: {
        doctor,
        appointmentCount: {
          total,
          completed,
          pending
        }
      }
    });
  } catch (error) {
    console.error('Get Doctor Detail Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * UPDATE DOCTOR
 * =====================================================
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findOneAndUpdate(
      { _id: id, clinicId: req.clinicId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    return res.json({
      success: true,
      message: 'Doctor updated successfully',
      data: doctor
    });
  } catch (error) {
    console.error('Update Doctor Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * DELETE DOCTOR (SAFE)
 * =====================================================
 */
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const appointmentCount = await Appointment.countDocuments({
      clinicId: req.clinicId,
      doctorId: id
    });

    if (appointmentCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete doctor with existing appointments'
      });
    }

    const doctor = await Doctor.findOneAndDelete({
      _id: id,
      clinicId: req.clinicId
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    return res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
  } catch (error) {
    console.error('Delete Doctor Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
