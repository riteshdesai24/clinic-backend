const Attendance = require('../models/Attendance');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper: return today's date as YYYY-MM-DD in local time
function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: compute status based on clockIn time
function computeStatus(clockIn) {
  const hour = clockIn.getHours();
  const minute = clockIn.getMinutes();
  const totalMinutes = hour * 60 + minute;
  // Example rule: late if clocked in after 09:15
  if (totalMinutes > 9 * 60 + 15) return 'LATE';
  return 'PRESENT';
}


/**
 * ============================
 * CLOCK IN
 * POST /api/attendance/clock-in
 * Staff clocks themselves in (role: STAFF / DOCTOR)
 * ============================
 */
exports.clockIn = async (req, res) => {
  try {
    const staffId = req.user.id;
    const clinicId = req.clinicId;
    const date = todayString();

    // Prevent duplicate clock-in on the same day
    const existing = await Attendance.findOne({ clinicId, staffId, date });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.clockIn
          ? 'Already clocked in today'
          : 'Attendance record already exists for today'
      });
    }

    const clockIn = new Date();
    const status = computeStatus(clockIn);

    const attendance = await Attendance.create({
      clinicId,
      staffId,
      date,
      clockIn,
      status,
      note: req.body.note || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Clocked in successfully',
      data: attendance
    });

  } catch (err) {
    console.error('Clock In Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


/**
 * ============================
 * CLOCK OUT
 * POST /api/attendance/clock-out
 * Staff clocks themselves out (role: STAFF / DOCTOR)
 * ============================
 */
exports.clockOut = async (req, res) => {
  try {
    const staffId = req.user.id;
    const clinicId = req.clinicId;
    const date = todayString();

    const attendance = await Attendance.findOne({ clinicId, staffId, date });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No clock-in record found for today. Please clock in first.'
      });
    }

    if (attendance.clockOut) {
      return res.status(409).json({
        success: false,
        message: 'Already clocked out today'
      });
    }

    const clockOut = new Date();
    const durationMinutes = Math.round(
      (clockOut - attendance.clockIn) / (1000 * 60)
    );

    // Mark HALF_DAY if worked less than 4 hours
    let status = attendance.status;
    if (durationMinutes < 4 * 60) {
      status = 'HALF_DAY';
    }

    attendance.clockOut = clockOut;
    attendance.durationMinutes = durationMinutes;
    attendance.status = status;
    if (req.body.note) attendance.note = req.body.note;

    await attendance.save();

    return res.json({
      success: true,
      message: 'Clocked out successfully',
      data: attendance
    });

  } catch (err) {
    console.error('Clock Out Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


/**
 * ============================
 * GET MY ATTENDANCE
 * GET /api/attendance/me
 * Staff views their own attendance history
 * ============================
 */
exports.getMyAttendance = async (req, res) => {
  try {
    const staffId = req.user.id;
    const clinicId = req.clinicId;

    const { from, to, cursor, limit = 20 } = req.query;

    const query = { clinicId, staffId };

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    if (cursor) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pageLimit = parseInt(limit);

    const records = await Attendance.find(query)
      .sort({ date: -1, _id: -1 })
      .limit(pageLimit + 1);

    const hasNextPage = records.length > pageLimit;
    if (hasNextPage) records.pop();

    const nextCursor = records.length > 0 ? records[records.length - 1]._id : null;

    return res.json({
      success: true,
      count: records.length,
      hasNextPage,
      nextCursor,
      data: records
    });

  } catch (err) {
    console.error('Get My Attendance Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


/**
 * ============================
 * GET TODAY STATUS (self)
 * GET /api/attendance/me/today
 * ============================
 */
exports.getTodayStatus = async (req, res) => {
  try {
    const staffId = req.user.id;
    const clinicId = req.clinicId;

    const record = await Attendance.findOne({
      clinicId,
      staffId,
      date: todayString()
    });

    return res.json({
      success: true,
      data: record || null,
      isClockedIn: !!(record && record.clockIn && !record.clockOut),
      isClockedOut: !!(record && record.clockOut)
    });

  } catch (err) {
    console.error('Today Status Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


/**
 * ============================
 * ADMIN: LIST ATTENDANCE (all staff)
 * GET /api/attendance
 * Query: staffId, date, from, to, status, cursor, limit
 * ============================
 */
exports.listAttendance = async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const { staffId, date, from, to, status, cursor, limit = 20 } = req.query;

    const query = { clinicId };

    if (staffId) query.staffId = staffId;
    if (status) query.status = status;

    if (date) {
      query.date = date;
    } else if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    if (cursor) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const pageLimit = parseInt(limit);

    const records = await Attendance.find(query)
      .populate('staffId', 'staffname email role')
      .sort({ date: -1, _id: -1 })
      .limit(pageLimit + 1);

    const hasNextPage = records.length > pageLimit;
    if (hasNextPage) records.pop();

    const nextCursor = records.length > 0 ? records[records.length - 1]._id : null;

    return res.json({
      success: true,
      count: records.length,
      hasNextPage,
      nextCursor,
      data: records
    });

  } catch (err) {
    console.error('List Attendance Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


/**
 * ============================
 * ADMIN: MARK ATTENDANCE MANUALLY
 * POST /api/attendance/mark
 * Mark a staff member as ABSENT or override a record
 * ============================
 */
exports.markAttendance = async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const { staffId, date, status, note, clockIn, clockOut } = req.body;

    if (!staffId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'staffId, date, and status are required'
      });
    }

    const allowedStatuses = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(', ')}`
      });
    }

    // Verify staff belongs to this clinic
    const staff = await User.findOne({ _id: staffId, clinicId });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const updateData = { status, note: note || '' };
    if (clockIn) updateData.clockIn = new Date(clockIn);
    if (clockOut) {
      updateData.clockOut = new Date(clockOut);
      if (updateData.clockIn) {
        updateData.durationMinutes = Math.round(
          (new Date(clockOut) - new Date(clockIn)) / (1000 * 60)
        );
      }
    }

    const attendance = await Attendance.findOneAndUpdate(
      { clinicId, staffId, date },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendance
    });

  } catch (err) {
    console.error('Mark Attendance Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


/**
 * ============================
 * ADMIN: GET ATTENDANCE SUMMARY
 * GET /api/attendance/summary
 * Query: staffId (optional), from, to
 * Returns per-staff totals: present, absent, half_day, late, totalHours
 * ============================
 */
exports.getAttendanceSummary = async (req, res) => {
  try {
    const clinicId = req.clinicId;
    const { staffId, from, to } = req.query;

    const matchStage = {
      clinicId: new mongoose.Types.ObjectId(clinicId)
    };

    if (staffId) matchStage.staffId = new mongoose.Types.ObjectId(staffId);

    if (from || to) {
      matchStage.date = {};
      if (from) matchStage.date.$gte = from;
      if (to) matchStage.date.$lte = to;
    }

    const summary = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$staffId',
          present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
          half_day: { $sum: { $cond: [{ $eq: ['$status', 'HALF_DAY'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'LATE'] }, 1, 0] } },
          totalMinutes: { $sum: { $ifNull: ['$durationMinutes', 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'staff'
        }
      },
      { $unwind: '$staff' },
      {
        $project: {
          staffId: '$_id',
          staffname: '$staff.staffname',
          email: '$staff.email',
          role: '$staff.role',
          present: 1,
          absent: 1,
          half_day: 1,
          late: 1,
          totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] }
        }
      },
      { $sort: { staffname: 1 } }
    ]);

    return res.json({
      success: true,
      count: summary.length,
      data: summary
    });

  } catch (err) {
    console.error('Summary Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


/**
 * ============================
 * ADMIN: DELETE ATTENDANCE RECORD
 * DELETE /api/attendance/:id
 * ============================
 */
exports.deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findOneAndDelete({
      _id: req.params.id,
      clinicId: req.clinicId
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    return res.json({ success: true, message: 'Attendance record deleted' });

  } catch (err) {
    console.error('Delete Attendance Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
