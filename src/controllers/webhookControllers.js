const { getClinicByPhoneNumberId } = require("../services/clinicService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

const handleWebhook = async (req, res) => {
  console.log("🔥 WEBHOOK HIT");

  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      console.log("No value in webhook body");
      return res.sendStatus(200);
    }

    const phoneNumberId = value.metadata?.phone_number_id;
    const message = value.messages?.[0];

    if (!phoneNumberId) {
      console.log("No phoneNumberId found");
      return res.sendStatus(200);
    }

    if (!message) {
      console.log("No message object found");
      return res.sendStatus(200);
    }

    if (message.type !== "text") {
      console.log("Ignoring non-text message");
      return res.sendStatus(200);
    }

    console.log("📩 Incoming message:", message.text?.body);

    const clinic = await getClinicByPhoneNumberId(phoneNumberId);

    if (!clinic) {
      console.log("Clinic not found for phoneNumberId:", phoneNumberId);
      return res.sendStatus(200);
    }

    if (clinic.status !== "active") {
      console.log("Clinic inactive:", clinic.id);
      return res.sendStatus(200);
    }

    const from = message.from;

    const result = await sendWhatsAppMessage({
      accessToken: clinic.accessToken, // ✅ ahora usa el token de la DB
      phoneNumberId: clinic.phoneNumberId,
      to: from,
      message: "Hola 👋 Soy tu asistente virtual.",
    });

    if (!result.success) {
      console.log("⚠️ Message failed but server stays alive");
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ Webhook internal error:", error.message);
    return res.sendStatus(200); 
    // ⚠️ Siempre 200 para que Meta no reintente en loop
  }
};

module.exports = {
  handleWebhook,
};