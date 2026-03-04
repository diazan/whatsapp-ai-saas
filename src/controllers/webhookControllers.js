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
      accessToken: "EAARx19PbSFkBQ65wDZAVJsK7eyanoxfJZBfnt3LtXJu9rF6XAmE5ZBnYOSzBIZA91c1UZActGNEgsERkGkeR4MAZBjd4uBYk9fIcQ5hFvuVYHKTMc2cabZCt51ljZAMJrwQZCm0rglzZCZAvlmuafKgC8cKZAZAKlYtqQ5y9VLR7h3488nCZA5lURYYOb3JpXZCu48JM4nQmgZDZD",
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