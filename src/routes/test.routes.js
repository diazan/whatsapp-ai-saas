const express = require("express");
const router = express.Router();
const { createAppointment } = require("../services/bookingService");

router.post("/test-booking", async (req, res) => {
  try {
    const {
      tenantId,
      serviceId,
      patientName,
      patientPhone,
      startAt,
    } = req.body;

    const appointment = await createAppointment({
      tenantId,
      serviceId,
      patientName,
      patientPhone,
      startAt,
    });

    res.json({
      success: true,
      appointment,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;