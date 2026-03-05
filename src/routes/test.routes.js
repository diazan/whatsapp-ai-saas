const express = require("express");
const router = express.Router();

const { createAppointment } = require("../services/bookingService");

router.post("/test-booking", async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const appointment = await createAppointment(req.body);

    return res.json({
      success: true,
      appointment,
    });

  } catch (error) {
    console.error("🔥 ERROR REAL:", error);

    return res.status(400).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

module.exports = router;