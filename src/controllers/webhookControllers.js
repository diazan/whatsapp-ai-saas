const { getClinicByPhoneNumberId } = require("../services/clinicService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

const handleWebhook = async (req, res) => {
  try {
    const phoneNumberId =
      req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (!phoneNumberId) {
      return res.sendStatus(200);
    }
    console.log("PHONE NUMBER ID:", phoneNumberId);
    const clinic = await getClinicByPhoneNumberId(phoneNumberId);
    console.log("CLINIC ENCONTRADA:", clinic);

    if (!clinic) {
      console.log("Clinic not found");
      return res.sendStatus(200);
    }

    console.log("TOKEN USADO:", clinic.accessToken);

    if (clinic.status !== "active") {
      console.log("Clinic inactive");
      return res.sendStatus(200);
    }

    const from =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

    if (!from) {
      return res.sendStatus(200);
    }

    console.log("CLINIC COMPLETA:", clinic);

    await sendWhatsAppMessage({
      accessToken: clinic.accessToken,
      phoneNumberId: clinic.phoneNumberId,
      to: from,
      message: "Hola 👋 Soy tu asistente virtual.",
    });

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
};

module.exports = {
  handleWebhook,
};

console.log("Body completo:", JSON.stringify(req.body, null, 2));