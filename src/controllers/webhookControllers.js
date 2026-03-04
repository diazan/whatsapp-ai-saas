const { getClinicByPhoneNumberId } = require("../services/clinicService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

const handleWebhook = async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;

    if (!value) return res.sendStatus(200);

    const phoneNumberId = value.metadata?.phone_number_id;
    const message = value.messages?.[0];

    if (!phoneNumberId || !message || message.type !== "text") {
      return res.sendStatus(200);
    }

    const clinic = await getClinicByPhoneNumberId(phoneNumberId);

    if (!clinic || clinic.status !== "active") {
      return res.sendStatus(200);
    }

    const from = message.from;

    await sendWhatsAppMessage({
      accessToken: clinic.accessToken,
      phoneNumberId: clinic.phoneNumberId,
      to: from,
      message: "Hola 👋 Soy tu asistente virtual.",
    });

    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ Webhook error:", error.response?.data || error.message);
    return res.sendStatus(500);
  }
};

module.exports = {
  handleWebhook,
};