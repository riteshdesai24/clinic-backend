const Appointment = require('../models/Dashappcount');

/**
 * =====================================================
 * HELPER: COUNT APPOINTMENTS BY STATUS
 * =====================================================
 */
const getCounts = async (clinicId, start, end) => {
  const baseQuery = {
    clinicId,
    startTime: { $gte: start, $lte: end }
  };

  const [all, pending, completed, cancelled] = await Promise.all([
    Appointment.countDocuments(baseQuery),
    Appointment.countDocuments({ ...baseQuery, status: 'PENDING' }),
    Appointment.countDocuments({ ...baseQuery, status: 'COMPLETED' }),
    Appointment.countDocuments({ ...baseQuery, status: 'CANCELLED' })
  ]);

  return { all, pending, completed, cancelled };
};

/**
 * =====================================================
 * TODAY APPOINTMENT COUNT (ALL)
 * =====================================================
 */
exports.todayCounts = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const data = await getCounts(req.clinicId, start, end);

    return res.json({
      success: true,
      period: 'TODAY',
      data
    });
  } catch (error) {
    console.error('Today Count Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * WEEKLY APPOINTMENT COUNT (ALL)
 * =====================================================
 */
exports.weeklyCounts = async (req, res) => {
  try {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay()); // Sunday
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const data = await getCounts(req.clinicId, start, end);

    return res.json({
      success: true,
      period: 'WEEK',
      data
    });
  } catch (error) {
    console.error('Weekly Count Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * =====================================================
 * MONTHLY APPOINTMENT COUNT (ALL)
 * =====================================================
 */
exports.monthlyCounts = async (req, res) => {
  try {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    const data = await getCounts(req.clinicId, start, end);

    return res.json({
      success: true,
      period: 'MONTH',
      data
    });
  } catch (error) {
    console.error('Monthly Count Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
