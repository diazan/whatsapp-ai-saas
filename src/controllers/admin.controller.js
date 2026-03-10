const { loginClinic } = require("../services/admin.service");
const { generateToken } = require("../lib/jwt");
const { getAppointments } = require("../services/admin.service");
const { updateAppointmentStatus } = require("../services/admin.service");
const logger = require('../utils/logger');

const healthCheck = async (req, res) => {
  return res.json({
    success: true,
    message: "Admin authenticated",
    clinic: {
      id: req.clinic.id,
      name: req.clinic.name,
      email: req.clinic.email,
    },
  });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const clinic = await loginClinic({ email, password });

    const token = generateToken({
      clinicId: clinic.id,
    });

    logger.info({
  type: 'admin_login_success',
  clinicId: clinic.id,
  email: clinic.email
});

    return res.json({
      success: true,
      token,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        email: clinic.email,
      },
    });
    } catch (error) {
    logger.warn({
        type: 'admin_login_failed',
        email: req.body?.email || null,
        reason: error.message
    });

    return res.status(401).json({
        success: false,
        message: error.message,
    });
    }
};

const listAppointments = async (req, res) => {
  try {
    const { from, to, status, page, pageSize } = req.query;

    const result = await getAppointments({
      clinicId: req.clinic.id,
      from,
      to,
      status,
      timeZone: req.clinic.timeZone,
      page,
      pageSize,
    });

    return res.json({
      success: true,
      count: result.total,
      page: result.page,
      pageSize: result.pageSize,
      metrics: result.metrics,
      data: result.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching appointments",
    });
  }
};

const changeAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await updateAppointmentStatus({
      clinicId: req.clinic.id,
      appointmentId: id,
      status,
    });

    logger.info({
    type: 'appointment_status_changed',
    clinicId: req.clinic.id,
    appointmentId: id,
    newStatus: status
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
  logger.warn({
    type: 'appointment_status_change_failed',
    clinicId: req.clinic?.id || null,
    appointmentId: req.params?.id || null,
    attemptedStatus: req.body?.status || null,
    reason: error.message
  });

  return res.status(400).json({
    success: false,
    message: error.message,
  });
}
};

module.exports = {
  healthCheck,
  login,
  listAppointments,
  changeAppointmentStatus,
};