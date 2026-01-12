const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Treatment = require('../models/Treatment');
const mongoose = require('mongoose');

/**
 * =====================================================
 * CREATE PATIENT
 * =====================================================
 */
exports.create = async (req, res) => {
  try {
    const patient = await Patient.create({
      ...req.body,
      clinicId: req.clinicId
    });

    return res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: patient
    });
  } catch (error) {
    console.error('Create Patient Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * LIST PATIENTS
 * Filters + Sorting + Cursor Pagination
 * =====================================================
 */
exports.list = async (req, res) => {
  try {
    const {
      cursor,
      limit = 10,
      gender,
      search,
      phone,
      startDate,
      endDate,
      sort = 'asc'
    } = req.query;

    const query = { clinicId: req.clinicId };

    if (gender) {
      query.gender = gender.toUpperCase(); // MALE | FEMALE
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (phone) {
      query.phone = { $regex: phone };
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (cursor) {
      query._id =
        sort === 'asc'
          ? { $gt: new mongoose.Types.ObjectId(cursor) }
          : { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pageLimit = parseInt(limit);

    const patients = await Patient.find(query)
      .sort({ _id: sort === 'asc' ? 1 : -1 })
      .limit(pageLimit + 1);

    const hasNextPage = patients.length > pageLimit;
    if (hasNextPage) patients.pop();

    const nextCursor =
      patients.length > 0
        ? patients[patients.length - 1]._id
        : null;

    return res.json({
      success: true,
      count: patients.length,
      hasNextPage,
      nextCursor,
      data: patients
    });
  } catch (error) {
    console.error('List Patients Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * PATIENT DETAIL
 * Patient + Appointments + Treatments + Appointment Count
 * =====================================================
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findOne({
      _id: id,
      clinicId: req.clinicId
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // ---- Appointment list ----
    const appointments = await Appointment.find({
      clinicId: req.clinicId,
      patientId: patient._id
    })
      .select('_id startTime endTime status')
      .sort({ startTime: -1 });

    // ---- Appointment counts ----
    const [total, completed, pending] = await Promise.all([
      Appointment.countDocuments({
        clinicId: req.clinicId,
        patientId: patient._id
      }),
      Appointment.countDocuments({
        clinicId: req.clinicId,
        patientId: patient._id,
        status: 'COMPLETED'
      }),
      Appointment.countDocuments({
        clinicId: req.clinicId,
        patientId: patient._id,
        status: 'PENDING'
      })
    ]);

    // ---- Treatments ----
    const treatments = await Treatment.find({
      clinicId: req.clinicId,
      patientId: patient._id
    })
      .select('_id description createdAt')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        patient,
        appointmentCount: {
          total,
          completed,
          pending
        },
        appointments,
        treatments
      }
    });
  } catch (error) {
    console.error('Get Patient Detail Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * UPDATE PATIENT
 * =====================================================
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findOneAndUpdate(
      { _id: id, clinicId: req.clinicId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    return res.json({
      success: true,
      message: 'Patient updated successfully',
      data: patient
    });
  } catch (error) {
    console.error('Update Patient Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * DELETE PATIENT
 * =====================================================
 */
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const appointmentCount = await Appointment.countDocuments({
      clinicId: req.clinicId,
      patientId: id
    });

    if (appointmentCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete patient with existing appointments'
      });
    }

    const patient = await Patient.findOneAndDelete({
      _id: id,
      clinicId: req.clinicId
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    return res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    console.error('Delete Patient Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
