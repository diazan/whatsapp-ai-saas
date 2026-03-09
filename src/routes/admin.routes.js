const express = require("express");
const router = express.Router();

const {
  healthCheck,
  login,
  listAppointments,
  changeAppointmentStatus,
} = require("../controllers/admin.controller");

const { authenticateAdmin } = require("../middleware/auth.middleware");

// ✅ Público
router.post("/login", login);

// ✅ Protegido
router.get("/health", authenticateAdmin, healthCheck);
router.get(
  "/appointments",
  authenticateAdmin,
  listAppointments
);

router.patch(
  "/appointments/:id/status",
  authenticateAdmin,
  changeAppointmentStatus
);

module.exports = router;