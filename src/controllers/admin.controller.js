const { loginClinic } = require("../services/admin.service");
const { generateToken } = require("../lib/jwt");
const { getAppointments } = require("../services/admin.service");
const { updateAppointmentStatus } = require("../services/admin.service");
const logger = require('../utils/logger');
const { sendWhatsAppMessage } = require("../services/whatsappService");

const healthCheck = async (req, res) => {
  return res.json({
    success: true,
    message: "Admin authenticated",
    clinic: {
      id: req.clinic.id,
      name: req.clinic.name,
      email: req.clinic.email,
      notificationsActive: req.clinic.notificationsActive,
      adminPhone: req.clinic.adminPhone
    },
  });
};

const prisma = require("../lib/prisma");

const listSalesDemos = async (req, res) => {
  try {
    const demos = await prisma.salesDemoRequest.findMany({
      orderBy: { createdAt: "desc" }
    });

    res.json(demos);

  } catch (error) {
    console.error("Error listing sales demos:", error.message);
    res.status(500).json({ error: "Error listing sales demos" });
  }
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
        phoneNumberId: clinic.phoneNumberId
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

const sendSalesMeetLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { meetLink } = req.body;
    const clinic = req.clinic;

    if (!meetLink) {
      return res.status(400).json({
        success: false,
        message: "meetLink is required"
      });
    }

    // Verificar que el prospecto pertenece a esta clínica
    const demo = await prisma.salesDemoRequest.findFirst({
      where: { id, clinicId: clinic.id }
    });

    if (!demo) {
      return res.status(404).json({
        success: false,
        message: "Demo request not found"
      });
    }

    const message = meetLink;

    // 🎯 USAR PHONENUMBERID REAL PARA USUARIO DE VENTAS
    const sendingPhoneNumberId = clinic.email === 'sales@demo.com' 
      ? '993943513813000'  // PhoneNumberId real para envío
      : clinic.phoneNumberId;

    console.log("🔧 SALES DEBUG:", {
      clinicEmail: clinic.email,
      originalPhoneNumberId: clinic.phoneNumberId,
      sendingPhoneNumberId: sendingPhoneNumberId
    });

    const result = await sendWhatsAppMessage({
      accessToken: clinic.accessToken,
      phoneNumberId: sendingPhoneNumberId,  // ← ARREGLADO
      to: demo.phone,
      message
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send WhatsApp message",
        detail: result.error
      });
    }

    // Persistir tracking en UTC
    const updated = await prisma.salesDemoRequest.update({
      where: { id },
      data: {
        meetLink,
        meetLinkSentAt: new Date()
      }
    });

    logger.info({
      type: "sales_meet_link_sent",
      clinicId: clinic.id,
      demoId: id,
      to: demo.phone
    });

    return res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    logger.warn({
      type: "sales_meet_link_failed",
      clinicId: req.clinic?.id || null,
      demoId: req.params?.id || null,
      reason: error.message
    });

    return res.status(500).json({
      success: false,
      message: "Failed to send meet link"
    });
  }
};

const changeSalesDemoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const clinic = req.clinic;

    const validStatuses = ["pending", "attended", "not_attended", "accepted", "rejected"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const demo = await prisma.salesDemoRequest.findFirst({
      where: { id, clinicId: clinic.id }
    });

    if (!demo) {
      return res.status(404).json({
        success: false,
        message: "Demo not found"
      });
    }

    const updated = await prisma.salesDemoRequest.update({
      where: { id },
      data: { status }
    });

    logger.info({
      type: "sales_demo_status_changed",
      clinicId: clinic.id,
      demoId: id,
      newStatus: status
    });

    return res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    logger.warn({
      type: "sales_demo_status_change_failed",
      clinicId: req.clinic?.id || null,
      demoId: req.params?.id || null,
      reason: error.message
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update status"
    });
  }
};

const toggleNotifications = async (req, res) => {
  try {
    const clinic = req.clinic;

    const updated = await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        notificationsActive: !clinic.notificationsActive
      }
    });

    logger.info({
      type: "clinic_notifications_toggled",
      clinicId: clinic.id,
      notificationsActive: updated.notificationsActive
    });

    return res.json({
      success: true,
      notificationsActive: updated.notificationsActive
    });

  } catch (error) {
     console.error("TOGGLE ERROR:", error.message); 
    logger.warn({
      type: "clinic_notifications_toggle_failed",
      clinicId: req.clinic?.id || null,
      reason: error.message
    });

    return res.status(500).json({
      success: false,
      message: "Failed to toggle notifications"
    });
  }
};

const metaHealth = async (req, res) => {
  const { accessToken, phoneNumberId } = req.clinic;

  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;
  const WABA_ID = process.env.META_WABA_ID;

  const checks = {
    token: { valid: false },
    phoneNumber: { valid: false },
    webhook: { subscribed: false }
  };

  // CHECK 1 — Token
  try {
    const url = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${APP_ID}|${APP_SECRET}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data?.data?.is_valid) {
      const expiresAt = data.data.expires_at;
      const now = Math.floor(Date.now() / 1000);

      // expires_at: 0 significa token permanente (System User)
      const isPermanent = expiresAt === 0;
      const daysRemaining = isPermanent
        ? null
        : Math.floor((expiresAt - now) / 86400);

      checks.token = {
        valid: true,
        permanent: isPermanent,
        expiresAt: isPermanent ? null : expiresAt,
        daysRemaining: isPermanent ? null : daysRemaining,
        scopes: data.data.scopes || []
      };
    } else {
      checks.token = {
        valid: false,
        error: data?.data?.error?.message || "Invalid token"
      };
    }
  } catch (err) {
    checks.token = {
      valid: false,
      error: "Token check failed"
    };
  }

  // CHECK 2 — PhoneNumber (via WABA phone_numbers)
try {
  const url = `https://graph.facebook.com/v18.0/${WABA_ID}/phone_numbers?access_token=${accessToken}`;
  const response = await fetch(url);
  const data = await response.json();

  const numbers = data?.data || [];
  const found = numbers.find(n => n.id === phoneNumberId);

  if (found) {
    checks.phoneNumber = {
      valid: true,
      phoneNumberId: found.id,
      verifiedName: found.verified_name,
      displayPhoneNumber: found.display_phone_number
    };
  } else {
    checks.phoneNumber = {
      valid: false,
      error: "Phone number not found in WABA"
    };
  }
} catch (err) {
  checks.phoneNumber = {
    valid: false,
    error: "Phone number check failed"
  };
}

// CHECK 3 — App subscription (Webhook)
try {
  const url = `https://graph.facebook.com/v18.0/${WABA_ID}/subscribed_apps?access_token=${accessToken}`;
  const response = await fetch(url);
  const data = await response.json();

  const apps = data?.data || [];
  const isSubscribed = apps.length > 0;

  checks.webhook = {
    subscribed: isSubscribed,
    totalSubscriptions: apps.length
  };
} catch (err) {
  checks.webhook = {
    subscribed: false,
    error: "Webhook check failed"
  };
}

  // STATUS FINAL
  let status = "ok";

  if (!checks.token.valid) {
    status = "critical";
  } else if (!checks.phoneNumber.valid || !checks.webhook.subscribed) {
    status = "degraded";
  }

  const success = status === "ok";

  logger.info({
    type: "meta_health_check",
    clinicId: req.clinic.id,
    status
  });

  return res.json({
    success,
    status,
    checks
  });
};


module.exports = {
  healthCheck,
  login,
  listAppointments,
  changeAppointmentStatus,
  listSalesDemos,
  sendSalesMeetLink,
  changeSalesDemoStatus,
  toggleNotifications,
  metaHealth
};