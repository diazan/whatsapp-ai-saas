const express = require("express");
const router = express.Router();
const { sendManualMessage } = require("../controllers/manualMessage.controller");


const {
  healthCheck,
  login,
  listAppointments,
  changeAppointmentStatus,
  listSalesDemos,
  sendSalesMeetLink,
  changeSalesDemoStatus,
  toggleNotifications,
  metaHealth  // ← faltaba esto
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

router.get(
  "/meta-health",
  authenticateAdmin,
  metaHealth
);

router.patch(
  "/appointments/:id/status",
  authenticateAdmin,
  changeAppointmentStatus
);

router.patch(
  "/sales-demos/:id/status",
  authenticateAdmin,
  changeSalesDemoStatus
);

router.post(
  "/send-manual-message",
  authenticateAdmin,
  sendManualMessage
);

router.post(
  "/sales-demos/:id/send-meet-link",
  authenticateAdmin,
  sendSalesMeetLink
);

router.patch(
  "/clinic/notifications-toggle",
  authenticateAdmin,
  toggleNotifications
);

module.exports = router;