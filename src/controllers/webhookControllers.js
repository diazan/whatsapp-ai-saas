const { getClinicByPhoneNumberId } = require("../services/clinicService");
const { sendWhatsAppMessage } = require("../services/whatsappService");
const {
  getReminderWindowAppointment
} = require("../services/bookingService");
const { evaluateClinicNotification } = require("../services/clinicNotificationService");
const { evaluateSalesNotification } = require("../services/salesNotificationService");
const prisma = require("../lib/prisma");

const processedMessages = new Set();

const handleWebhook = async (req, res) => {
  console.log("🔥 WEBHOOK HIT");
  
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

    if (!value.messages || value.messages.length === 0) {
      console.log("No incoming messages (probably status update)");
      return;
    }

    const message = value.messages[0];

    if (processedMessages.has(message.id)) {
      console.log("Duplicate message ignored:", message.id);
      return;
    }

    processedMessages.add(message.id);

    setTimeout(() => {
      processedMessages.delete(message.id);
    }, 5 * 60 * 1000);

    if (message.from === phoneNumberId) {
      console.log("Ignoring own message (loop prevention)");
      return;
    }

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

    const reminderAppointment = await getReminderWindowAppointment({
      clinicId: clinic.id,
      patientPhone: from
    });

    if (reminderAppointment) {

      const textLower = incomingText.toLowerCase().trim();

      // ✅ Solo interceptar si NO es comando global
      const isGlobalCommand =
        textLower === "0" ||
        textLower === "hola" ||
        textLower === "inicio";

      if (!isGlobalCommand) {

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

        // ✅ Respuesta inválida dentro del contexto de reminder
        await sendWhatsAppMessage({
          accessToken: clinic.accessToken,
          phoneNumberId: clinic.phoneNumberId,
          to: from,
          message:
            "Por favor responde con el número de una opción:\n\n1️⃣ Confirmar asistencia\n2️⃣ Cancelar cita"
        });

        return;
      }

      // ✅ Si es comando global → cae al flujo normal abajo
    }

    const { handleIncomingMessage } = require("../services/conversation.state-machine");
    const { handleSalesBotMessage } = require("../services/salesBot.service");


    if (process.env.DEMO_PHONE_NUMBER_ID && 
        clinic.phoneNumberId === process.env.DEMO_PHONE_NUMBER_ID) {

        const salesConversation = await prisma.conversation.findFirst({
        where: {
          clinicId: clinic.id,
          patientPhone: from,
          active: true
        }
      });

      await handleSalesBotMessage({
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

      await evaluateSalesNotification({
        phone: from,
        clinic,
        incomingMessage: incomingText,
        conversationState: salesConversation?.state ?? "SALES_IDLE"
      });

      return;
    }

    // ✅ Leer estado ANTES con prisma directo
    const currentConversation = await prisma.conversation.findFirst({
      where: {
        clinicId: clinic.id,
        patientPhone: from,
        active: true
      }
    });

    console.log("💬 Procesando mensaje de:", from);
    console.log("💬 Texto:", incomingText);
    console.log("💬 Message ID:", message.id);
    console.log("💬 Estado conversación:", currentConversation?.state ?? "SIN CONVERSACIÓN");
    console.log("💬 ExpiresAt:", currentConversation?.expiresAt ?? "N/A");

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

    // ✅ Una sola llamada con estado correcto
    await evaluateClinicNotification({
      phone: from,
      clinic,
      incomingMessage: incomingText,
      conversationState: currentConversation?.state ?? "IDLE"
    });

  } catch (error) {
    console.error("❌ Webhook internal error:", error.message);
  }
};

module.exports = {
  handleWebhook,
};