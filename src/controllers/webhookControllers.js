const { getClinicByPhoneNumberId } = require("../services/clinicService");
const { sendWhatsAppMessage } = require("../services/whatsappService");
const {
  getReminderWindowAppointment
} = require("../services/bookingService");
const { evaluateClinicNotification } = require("../services/clinicNotificationService");

const prisma = require("../lib/prisma"); // para confirmar/cancelar cita

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
    console.log("📌 Incoming phoneNumberId:", phoneNumberId);
    console.log("📌 DEMO_PHONE_NUMBER_ID env:", process.env.DEMO_PHONE_NUMBER_ID);

   
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

    // ✅ 3. Protección anti-duplicado
    if (processedMessages.has(message.id)) {
      console.log("Duplicate message ignored:", message.id);
      return;
    }

    processedMessages.add(message.id);

    setTimeout(() => {
      processedMessages.delete(message.id);
    }, 5 * 60 * 1000);

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

    console.log("📍 About to call getClinicByPhoneNumberId");
    console.log("📍 phoneNumberId being sent:", phoneNumberId);
    console.log("📍 typeof phoneNumberId:", typeof phoneNumberId);


    const clinic = await getClinicByPhoneNumberId(phoneNumberId);

    console.log("🧪 clinic.phoneNumberId:", clinic.phoneNumberId);
console.log("🧪 DEMO_PHONE_NUMBER_ID:", process.env.DEMO_PHONE_NUMBER_ID);
console.log("🧪 equal?:", clinic.phoneNumberId === process.env.DEMO_PHONE_NUMBER_ID);

    if (!clinic) {
      console.log("Clinic not found for phoneNumberId:", phoneNumberId);
      return;
    }

    if (clinic.status !== "active") {
      console.log("Clinic inactive:", clinic.id);
      return;
    }

    const from = message.from;

    // ✅ INTERCEPTAR RESPUESTA A RECORDATORIO (ventana 23–24h exacta)
    const reminderAppointment = await getReminderWindowAppointment({
      clinicId: clinic.id,
      patientPhone: from
    });

    if (reminderAppointment) {

      // ✅ CONFIRMAR
      if (incomingText === "1") {

        await prisma.appointment.update({
          where: { id: reminderAppointment.id },
          data: { status: "confirmed" }
        });

        await sendWhatsAppMessage({
          accessToken: clinic.accessToken,
          phoneNumberId: clinic.phoneNumberId,
          to: from,
          message: "✅ Tu cita ha sido confirmada. ¡Te esperamos!"
        });

        return;
      }

      // ✅ CANCELAR
      if (incomingText === "2") {

        await prisma.appointment.update({
          where: { id: reminderAppointment.id },
          data: { status: "cancelled" }
        });

        await sendWhatsAppMessage({
          accessToken: clinic.accessToken,
          phoneNumberId: clinic.phoneNumberId,
          to: from,
          message:
            "✅ Tu cita ha sido cancelada.\nSi deseas agendar nuevamente, escríbenos cuando quieras."
        });

        return;
      }

      // ✅ RESPUESTA INVÁLIDA DENTRO DEL CONTEXTO DE REMINDER
      await sendWhatsAppMessage({
        accessToken: clinic.accessToken,
        phoneNumberId: clinic.phoneNumberId,
        to: from,
        message:
          "Por favor responde con el número de una opción:\n\n1️⃣ Confirmar asistencia\n2️⃣ Cancelar cita"
      });
       
      return;
    }

    // ✅ Flujo normal (state machine)
    const { handleIncomingMessage } = require("../services/conversation.state-machine");

    const { handleSalesBotMessage } = require("../services/salesBot.service");



    const isDemoClinic =
  clinic.phoneNumberId === process.env.DEMO_PHONE_NUMBER_ID;

if (isDemoClinic) {

  return handleSalesBotMessage({
    clinic,
    message: incomingText,
    patientPhone: from,
    sendMessage: async (text) => {
      await sendWhatsAppMessage({
        accessToken: clinic.accessToken,
        phoneNumberId: clinic.phoneNumberId,
        to: from,
        message: text,
      });
    }
  });
}

    await handleIncomingMessage({
      clinic,
      message: incomingText,
      patientPhone: from,
      patientName: null,
      sendMessage: async (text) => {
        await sendWhatsAppMessage({
          accessToken: clinic.accessToken,
          phoneNumberId: clinic.phoneNumberId,
          to: from,
          message: text,
        });
      }
    });

    evaluateClinicNotification({
  phone: from,
  clinic,
  incomingMessage: incomingText
}).catch(() => {});

  } catch (error) {
    console.error("❌ Webhook internal error:", error.message);
  }
};

module.exports = {
  handleWebhook,
};