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

    const {
      firstName,
      lastName,
      phone,
      email,
      address1,
      address2,
      address3,
      age,
      gender,
      medicalAllergies,
      pincode
    } = req.body;

    // Validation
    if (!firstName || !lastName || !phone || !gender) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, phone and gender are required'
      });
    }

    const patient = await Patient.create({

      clinicId: req.clinicId,

      firstName,
      lastName,
      phone,
      email,

      address1,
      address2,
      address3,

      age,
      gender,

      medicalAllergies,
      pincode
    });

    return res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: patient
    });

  } catch (error) {

    console.error('Create Patient Error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Patient with this phone already exists'
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
 * LIST PATIENTS
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

    // Gender filter
    if (gender) {
      query.gender = gender.toUpperCase();
    }

    // Search
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search } }
      ];
    }

    // Phone filter
    if (phone) {
      query.phone = { $regex: phone };
    }

    // Date filter
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Cursor pagination
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
 * GET PATIENT DETAIL
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

    // Appointments
    const appointments = await Appointment.find({
      clinicId: req.clinicId,
      patientId: patient._id
    })
      .populate('doctorId', 'staffname email phone specialization')
      .sort({ startTime: -1 });

    // Appointment stats
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

    // Treatments
    const treatments = await Treatment.find({
      clinicId: req.clinicId,
      patientId: patient._id
    })
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

    console.error('Get Patient Error:', error);

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
      {
        _id: id,
        clinicId: req.clinicId
      },
      req.body,
      {
        new: true,
        runValidators: true
      }
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
        message: 'Cannot delete patient with appointments'
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
