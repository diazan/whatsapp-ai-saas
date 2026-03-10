const { loginClinic } = require("../services/admin.service");
const { generateToken } = require("../lib/jwt");
const { getAppointments } = require("../services/admin.service");
const { updateAppointmentStatus } = require("../services/admin.service");

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

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
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