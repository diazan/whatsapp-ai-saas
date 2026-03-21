const {
  getOrCreateConversation,
  updateConversation,
  closeConversation
} = require("./conversation.service");

const { getAvailableSlotsForDay } = require("./availability.service");
const { createAppointment } = require("./bookingService");
const { evaluateSalesNotification } = require("./salesNotificationService");
const { sendWhatsAppMessage } = require("./whatsappService");

const prisma = require("../lib/prisma");
const { DateTime } = require("luxon");

const {
  parseTimeInput,
  buildFutureDateTime
} = require("../utils/date.utils");

const {
  handleDemoMessage,
  isUserInDemo
} = require("./demoClinic.service");

const SALES_STATES = {
  IDLE: "SALES_IDLE",
  PROBLEM_HOOK: "SALES_PROBLEM_HOOK",
  ASK_VOLUME: "SALES_ASK_VOLUME",
  SHOW_RESULT: "SALES_SHOW_RESULT",
  MORE_INFO: "SALES_MORE_INFO",      // ✅ estado propio para "Más información"
  BOOKING_DATE: "SALES_BOOKING_DATE",
  BOOKING_TIME: "SALES_BOOKING_TIME",
  CUSTOM_TIME: "SALES_CUSTOM_TIME",
  ASK_NAME: "SALES_ASK_NAME",
  COMPLETED: "SALES_COMPLETED",
  RETURNING: "SALES_RETURNING"
};

const ESTIMATED_NO_SHOW_RATE = 0.15;
const RECOVERY_RATE = 0.6;

function getVolumeFromOption(option) {
  if (option === "1") return 80;
  if (option === "2") return 200;
  if (option === "3") return 400;
  return null;
}

async function getDemoServiceId(clinicId) {
  const service = await prisma.service.findFirst({
    where: {
      clinicId,
      name: "Demo SaaS Personalizada",
      active: true
    }
  });
  return service ? service.id : null;
}

function parseTime(text) {
  const cleaned = text.toLowerCase().replace(/\s/g, "");

  const regex24 = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
  const match24 = cleaned.match(regex24);

  if (match24) {
    const hour = match24[1].padStart(2, "0");
    const minute = match24[2];
    return `${hour}:${minute}`;
  }

  const regexAmPm = /^(\d{1,2})(?::([0-5]\d))?(am|pm)$/;
  const matchAmPm = cleaned.match(regexAmPm);

  if (matchAmPm) {
    let hour = parseInt(matchAmPm[1], 10);
    const minute = matchAmPm[2] || "00";
    const period = matchAmPm[3];

    if (hour < 1 || hour > 12) return null;
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    return `${hour.toString().padStart(2, "0")}:${minute}`;
  }

  return null;
}

// ─────────────────────────────────────────────
// HELPER — Capitalizar nombre correctamente
// ─────────────────────────────────────────────
function capitalizeName(name) {
  return name
    .trim()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// ─────────────────────────────────────────────
// BUILDER — SHOW_RESULT
// ─────────────────────────────────────────────

function buildShowResult(volume) {
  const lost = Math.floor(volume * ESTIMATED_NO_SHOW_RATE);
  const recoverable = Math.floor(lost * RECOVERY_RATE);

  return (
    `Con aproximadamente ${volume} citas al mes,\n\n` +
    `📉 Podrías estar perdiendo alrededor de ${lost} citas.\n\n` +
    `📈 *Kerbo-Flow* puede ayudarte a recuperar aproximadamente ${recoverable} citas mensuales.\n\n` +
    `¿Te gustaría agendar una demo personalizada?\n\n` +
    `1️⃣ Sí, agendar demo\n` +
    `2️⃣ Más información\n` +
    `3️⃣ Probar cómo funciona\n\n` +
    `0️⃣ Volver al inicio`
  );
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────

const handleSalesBotMessage = async ({
  clinic,
  message,
  patientPhone,
  sendMessage
}) => {

  const text = message.toLowerCase().trim();

  if (isUserInDemo(clinic.id, patientPhone)) {
    return handleDemoMessage({
      clinic,
      message,
      patientPhone,
      sendMessage
    });
  }

  const conversation = await getOrCreateConversation({
    clinicId: clinic.id,
    patientPhone,
    patientName: null
  });

  // ✅ Si ya tiene demo agendada
  const existingDemo = await prisma.salesDemoRequest.findFirst({
    where: {
      clinicId: clinic.id,
      phone: patientPhone
    },
    orderBy: { createdAt: "desc" }
  });

  if (existingDemo) {

    if (text === "inicio" || text === "hola") {
      await updateConversation(conversation.id, {
        state: SALES_STATES.RETURNING,
        context: {}
      });

      return sendMessage(
        "👋 Hola de nuevo. ¡Qué gusto verte por aquí!\n\n" +
        "¿En qué podemos ayudarte?\n\n" +
        "1️⃣ Ver información del servicio\n" +
        "2️⃣ Agendar nueva demo"
      );
    }

    const activeStates = [
      SALES_STATES.PROBLEM_HOOK,
      SALES_STATES.ASK_VOLUME,
      SALES_STATES.SHOW_RESULT,
      SALES_STATES.MORE_INFO,        // ✅ agregado
      SALES_STATES.BOOKING_DATE,
      SALES_STATES.BOOKING_TIME,
      SALES_STATES.CUSTOM_TIME,
      SALES_STATES.ASK_NAME,
      SALES_STATES.RETURNING
    ];

    if (activeStates.includes(conversation.state)) {
      // Dejar pasar al switch normalmente
    } else {
      evaluateSalesNotification({
        phone: patientPhone,
        clinic,
        incomingMessage: message
      }).catch(err => {
        console.error("[salesNotification] Error silencioso:", err.message);
      });
      return;
    }
  }

  console.log("[salesBot] Estado conversación:", conversation.state);

  // ─────────────────────────────────────────
  // ESCAPE GLOBAL "0"
  // ─────────────────────────────────────────

  if (text === "0") {

    // ✅ SOLO desde MORE_INFO → volver a SHOW_RESULT
    if (conversation.state === SALES_STATES.MORE_INFO) {
      const ctx = conversation.context;

      await updateConversation(conversation.id, {
        state: SALES_STATES.SHOW_RESULT
      });

      return sendMessage(buildShowResult(ctx.estimatedVolume));
    }

    // ✅ Todos los demás estados → ir al inicio
    await updateConversation(conversation.id, {
      state: SALES_STATES.PROBLEM_HOOK,
      context: {}
    });

    return sendMessage(
      "👋 Volvemos al inicio.\n\n" +
      "La mayoría de negocios con agenda pierden entre 10% y 25% de ingresos por cancelaciones y ausencias.\n\n" +
      "¿Quieres ver cómo funciona?\n\n" +
      "1️⃣ Sí, muéstrame"
    );
  }

  // ─────────────────────────────────────────
  // EXPIRACIÓN Y SALUDO
  // ─────────────────────────────────────────

  if (conversation.expired) {
    await updateConversation(conversation.id, {
      state: SALES_STATES.IDLE,
      context: {}
    });

    return sendMessage(
      "La sesión anterior expiró.\n\nEscribe *inicio* para comenzar nuevamente."
    );
  }

  if (text === "inicio" || text === "hola") {
    await updateConversation(conversation.id, {
      state: SALES_STATES.PROBLEM_HOOK,
      context: {}
    });

    return sendMessage(
      "👋 Hola. ¡Gracias por comunicarte con *Kerbo*!\n\n" +
      "La mayoría de negocios con agenda pierden entre 10% y 25% de ingresos por cancelaciones y ausencias.\n\n" +
      "*Kerbo-flow* ayuda a reducir eso automáticamente con confirmaciones y recordatorios por WhatsApp.\n\n" +
      "¿Quieres ver cómo funciona en tu clínica?\n\n" +
      "1️⃣ Sí, muéstrame"
    );
  }

  // ─────────────────────────────────────────
  // SWITCH PRINCIPAL
  // ─────────────────────────────────────────

  switch (conversation.state) {

    case SALES_STATES.PROBLEM_HOOK:

      if (text === "1") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.ASK_VOLUME
        });

        return sendMessage(
          "Perfecto ✅\n\n" +
          "¿Cuántas citas gestionas al mes aproximadamente?\n\n" +
          "1️⃣ Menos de 100\n" +
          "2️⃣ 100 – 300\n" +
          "3️⃣ Más de 300"
        );
      }

      return sendMessage("Escribe 1 para continuar.");

    case SALES_STATES.ASK_VOLUME: {

      const volume = getVolumeFromOption(text);
      if (!volume) return sendMessage("Por favor elige una opción válida.");

      await updateConversation(conversation.id, {
        state: SALES_STATES.SHOW_RESULT,
        context: {
          estimatedVolume: volume
        }
      });

      return sendMessage(buildShowResult(volume));
    }

    case SALES_STATES.SHOW_RESULT:

      if (text === "1") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.BOOKING_DATE
        });

        return sendMessage(
          "¿Para qué fecha deseas la demo?\nDD/MM/AAAA\n\n0️⃣ Volver al inicio"
        );
      }

      // ✅ Más información → estado propio MORE_INFO
      if (text === "2") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.MORE_INFO
        });

        return sendMessage(
          "Nuestro sistema incluye:\n\n" +
          "✅ Agendamiento automático por WhatsApp\n" +
          "✅ Confirmaciones y recordatorios sin intervención humana\n" +
          "✅ Reprogramaciones en un solo click\n" +
          "✅ Reducción del tiempo operativo del personal\n" +
          "✅ Panel con métricas reales de ocupación\n\n" +
          "0️⃣ Volver atrás"
        );
      }

      if (text === "3") {
        return handleDemoMessage({
          clinic,
          message: "__start__",
          patientPhone,
          sendMessage
        });
      }

      return sendMessage("Elige una opción válida.");

    // ✅ Estado propio para "Más información"
    case SALES_STATES.MORE_INFO:

      // El "0" ya está manejado por el escape global
      // Cualquier otro texto → volver a SHOW_RESULT
      await updateConversation(conversation.id, {
        state: SALES_STATES.SHOW_RESULT
      });

      return sendMessage(
        buildShowResult(conversation.context.estimatedVolume)
      );

    case SALES_STATES.BOOKING_DATE: {

      const dateObj = DateTime.fromFormat(text, "dd/MM/yyyy", {
        zone: clinic.timeZone
      });

      if (!dateObj.isValid) {
        return sendMessage("Fecha inválida. Usa formato DD/MM/AAAA");
      }

      const selectedDateISO = dateObj.toFormat("yyyy-MM-dd");
      const todayISO = DateTime.now()
        .setZone(clinic.timeZone)
        .toFormat("yyyy-MM-dd");

      if (selectedDateISO < todayISO) {
        return sendMessage("No puedes agendar fecha pasada.");
      }

      await updateConversation(conversation.id, {
        state: SALES_STATES.BOOKING_TIME,
        context: {
          ...conversation.context,
          dateISO: selectedDateISO
        }
      });

      return sendMessage(
        "⏰ ¿Qué hora te queda mejor?\n\n" +
        "Puedes escribir por ejemplo:\n" +
        "• 14:30\n" +
        "• 3pm\n\n" +
        "0️⃣ Volver atrás"
      );
    }

    case SALES_STATES.BOOKING_TIME: {

      const manualTime = parseTimeInput(text);

      if (!manualTime) {
        return sendMessage(
          "Hora inválida.\n\n" +
          "Puedes escribir por ejemplo:\n" +
          "• 14:30\n" +
          "• 3pm\n" +
          "• 3:30pm\n\n" +
          "0️⃣ Volver atrás"
        );
      }

      const proposedDateTime = buildFutureDateTime({
        dateISO: conversation.context.dateISO,
        time: manualTime,
        timeZone: clinic.timeZone
      });

      if (!proposedDateTime) {
        return sendMessage(
          "Esa hora ya pasó ⏳\n\n" +
          "Por favor elige una hora futura."
        );
      }

      await updateConversation(conversation.id, {
        state: SALES_STATES.ASK_NAME,
        context: {
          ...conversation.context,
          startAtISO: proposedDateTime.toISO()
        }
      });

      return sendMessage(
        "✅ Perfecto.\n\n¿Con qué nombre agendamos la demo?\n\n0️⃣ Volver atrás"
      );
    }

    case SALES_STATES.CUSTOM_TIME: {

      const manualTime = parseTime(text);
      if (!manualTime) return sendMessage("Hora inválida.");

      const startAtISO = DateTime.fromISO(
        `${conversation.context.dateISO}T${manualTime}`,
        { zone: clinic.timeZone }
      ).toISO();

      await updateConversation(conversation.id, {
        state: SALES_STATES.ASK_NAME,
        context: { ...conversation.context, startAtISO }
      });

      return sendMessage("¿Con qué nombre agendamos?");
    }

    case SALES_STATES.ASK_NAME: {

      if (!text || text.length < 2) {
        return sendMessage("Por favor indícame tu nombre 😊");
      }

      try {
        const preferredAtUTC = new Date(conversation.context.startAtISO);

        await prisma.salesDemoRequest.create({
          data: {
            clinicId: "sales-clinic-uuid-12345678",
            name: capitalizeName(text),
            phone: patientPhone,
            preferredAt: preferredAtUTC
          }
        });

        const adminPhone = process.env.ADMIN_PHONE;
        if (adminPhone) {
          const demoDate = DateTime.fromISO(
            conversation.context.startAtISO,
            { zone: clinic.timeZone }
          );

          sendWhatsAppMessage({
            accessToken: clinic.accessToken,
            phoneNumberId: clinic.phoneNumberId,
            to: adminPhone,
            message:
              `🎉 *Nueva Demo Agendada*\n\n` +
              `👤 *${capitalizeName(text)}*\n` +
              `📱 ${patientPhone}\n` +
              `📅 ${demoDate.toFormat("dd/MM/yyyy")}\n` +
              `⏰ ${demoDate.toFormat("hh:mm a")}\n\n` +
              `Revisa el dashboard para más detalles.`
          }).catch(err => {
            console.error("[salesNotification] Error notificando nueva demo:", err.message);
          });
        }

        await closeConversation(conversation.id, SALES_STATES.COMPLETED);

        const date = DateTime.fromISO(
          conversation.context.startAtISO,
          { zone: clinic.timeZone }
        );

        return sendMessage(
          `✅ *Solicitud de demo recibida*\n\n` +
          `Gracias, *${capitalizeName(text)}* 🙌\n\n` +
          `📅 ${date.toFormat("dd/MM/yyyy")}\n` +
          `⏰ ${date.toFormat("hh:mm a")}\n\n` +
          "Te enviaremos el enlace de Google Meet aproximadamente 15 minutos antes de la cita.\n\n" +
          "¡Nos vemos pronto! 🚀"
        );

      } catch (error) {
        console.log("🔴 SALES DEMO SAVE ERROR:", error.message);
        return sendMessage(
          "Hubo un problema guardando tu solicitud.\n" +
          "Por favor intenta nuevamente."
        );
      }
    }

    case SALES_STATES.COMPLETED:
      return;

    case SALES_STATES.RETURNING:

      if (text === "1") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.SHOW_RESULT
        });

        return sendMessage(
          "Nuestro sistema incluye:\n\n" +
          "✅ Agendamiento automático por WhatsApp\n" +
          "✅ Confirmaciones y recordatorios sin intervención humana\n" +
          "✅ Reprogramaciones en un solo click\n" +
          "✅ Reducción del tiempo operativo del personal\n" +
          "✅ Panel con métricas reales de ocupación\n\n" +
          "¿Deseas agendar una nueva demo?\n\n" +
          "1️⃣ Sí, agendar\n" +
          "0️⃣ Volver al inicio"
        );
      }

      if (text === "2") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.BOOKING_DATE
        });
        return sendMessage(
          "¿Para qué fecha deseas la demo?\nDD/MM/AAAA\n\n0️⃣ Volver al inicio"
        );
      }

      return sendMessage(
        "Por favor elige una opción:\n\n" +
        "1️⃣ Ver información del servicio\n" +
        "2️⃣ Agendar nueva demo"
      );

    default:
      return sendMessage("Escribe *inicio* para comenzar.");
  }
};

module.exports = {
  handleSalesBotMessage
};