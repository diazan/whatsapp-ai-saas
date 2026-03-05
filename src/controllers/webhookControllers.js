const { getClinicByPhoneNumberId } = require("../services/clinicService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

const processedMessages = new Set();
// ✅ Protección simple anti-duplicado en memoria (suficiente para MVP)

const handleWebhook = async (req, res) => {
  console.log("🔥 WEBHOOK HIT");

  // ✅ 1. RESPONDER INMEDIATAMENTE A META
  res.sendStatus(200);

  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      console.log("No value in webhook body");
      return;
    }

    const phoneNumberId = value.metadata?.phone_number_id;

    if (!phoneNumberId) {
      console.log("No phoneNumberId found");
      return;
    }

    // ✅ 2. Ignorar eventos que NO sean mensajes entrantes
    if (!value.messages || value.messages.length === 0) {
      console.log("No incoming messages (probably status update)");
      return;
    }

    const message = value.messages[0];

    // ✅ 3. Protección anti-duplicado (Meta puede reenviar eventos)
    if (processedMessages.has(message.id)) {
      console.log("Duplicate message ignored:", message.id);
      return;
    }

    processedMessages.add(message.id);

    // Limpieza básica de memoria (evita crecimiento infinito)
    setTimeout(() => {
      processedMessages.delete(message.id);
    }, 5 * 60 * 1000); // 5 minutos

    // ✅ 4. Ignorar mensajes enviados por el propio negocio
    if (message.from === phoneNumberId) {
      console.log("Ignoring own message (loop prevention)");
      return;
    }

    // ✅ 5. Solo texto en MVP
    if (message.type !== "text") {
      console.log("Ignoring non-text message");
      return;
    }

    const incomingText = message.text?.body?.trim();

    console.log("📩 Incoming message:", incomingText);

    const clinic = await getClinicByPhoneNumberId(phoneNumberId);

    if (!clinic) {
      console.log("Clinic not found for phoneNumberId:", phoneNumberId);
      return;
    }

    if (clinic.status !== "active") {
      console.log("Clinic inactive:", clinic.id);
      return;
    }

    const from = message.from;

    // ✅ 6. Enviar respuesta
    const result = await sendWhatsAppMessage({
      accessToken: clinic.accessToken,
      phoneNumberId: clinic.phoneNumberId,
      to: from,
      message: "Hola 👋 Soy tu asistente virtual.",
    });

    if (!result.success) {
      console.log("⚠️ Message failed but server stays alive");
    }

  } catch (error) {
    console.error("❌ Webhook internal error:", error.message);
    // ⚠️ NO devolver nada aquí, ya enviamos 200 arriba
  }
};

module.exports = {
  handleWebhook,
};