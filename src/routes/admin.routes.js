const express = require("express");
const router = express.Router();
const { sendManualMessage } = require("../controllers/manualMessage.controller");

const {
  healthCheck,
  login,
  listAppointments,
  changeAppointmentStatus,
  listSalesDemos
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

router.get(
  "/sales-demos",
  authenticateAdmin,
  listSalesDemos
);

router.patch(
  "/appointments/:id/status",
  authenticateAdmin,
  changeAppointmentStatus
);

router.post(
  "/send-manual-message",
  authenticateAdmin,
  sendManualMessage
);

module.exports = router;