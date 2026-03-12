const { sendWhatsAppMessage } = require("../services/whatsappService");
const prisma = require("../lib/prisma");

const sendManualMessage = async (req, res) => {
  try {
    const clinic = req.clinic;
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    

    if (!clinic) {
      return res.status(404).json({
        error: "Clinic not found"
      });
    }

    await sendWhatsAppMessage({
      accessToken: clinic.accessToken,
      phoneNumberId: clinic.phoneNumberId,
      to,
      message
    });

    console.log("Manual WhatsApp message sent:", {
    clinicId: clinic.id,
    to
    });

    return res.json({
      success: true
    });

  } catch (error) {

    console.error("Manual message error:", error.message);

    return res.status(500).json({
      error: "Failed to send message"
    });
  }
};

module.exports = {
  sendManualMessage
};