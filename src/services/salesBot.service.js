const {
  getOrCreateConversation,
  updateConversation,
  closeConversation
} = require("./conversation.service");

const { getAvailableSlotsForDay } = require("./availability.service");
const { createAppointment } = require("./bookingService");

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
  BOOKING_DATE: "SALES_BOOKING_DATE",
  BOOKING_TIME: "SALES_BOOKING_TIME",
  CUSTOM_TIME: "SALES_CUSTOM_TIME",
  ASK_NAME: "SALES_ASK_NAME",
  COMPLETED: "SALES_COMPLETED"
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

  // ✅ Escape global al inicio
if (text === "0") {

  await updateConversation(conversation.id, {
    state: SALES_STATES.PROBLEM_HOOK,
    context: {}
  });

  return sendMessage(
    "👋 Volvemos al inicio.\n\n" +
    "La mayoría de clínicas pierden entre 10% y 25% de ingresos por cancelaciones y ausencias.\n\n" +
    "¿Quieres ver cómo funciona?\n\n" +
    "1️⃣ Sí, muéstrame"
  );
}

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
      "La mayoría de clínicas pierden entre 10% y 25% de ingresos por cancelaciones y ausencias.\n\n" +
      "*Kerbo-flow* ayuda a reducir eso automáticamente con confirmaciones y recordatorios por WhatsApp.\n\n" +
      "¿Quieres ver cómo funciona en tu clínica?\n\n" +
      "1️⃣ Sí, muéstrame"
    );
  }

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

      const lost = Math.floor(volume * ESTIMATED_NO_SHOW_RATE);
      const recoverable = Math.floor(lost * RECOVERY_RATE);

      await updateConversation(conversation.id, {
        state: SALES_STATES.SHOW_RESULT,
        context: {
          estimatedVolume: volume,
          estimatedRecovery: recoverable
        }
      });

      return sendMessage(
        `Con aproximadamente ${volume} citas al mes,\n\n` +
        `📉 Podrías estar perdiendo alrededor de ${lost} citas.\n\n` +
        `📈 Kerbo puede ayudarte a recuperar aproximadamente ${recoverable} citas mensuales.\n\n` +
        "¿Te gustaría agendar una demo personalizada?\n\n" +
        "1️⃣ Sí, agendar demo\n" +
        "2️⃣ Más información\n" +
        "3️⃣ Probar cómo funciona\n\n" +
        "0️⃣ Volver al inicio"
      );
    }

    case SALES_STATES.SHOW_RESULT:

      if (text === "1") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.BOOKING_DATE
        });

        return sendMessage("¿Para qué fecha deseas la demo?\nDD/MM/AAAA\n\n0️⃣ Volver al inicio");
      }

      if (text === "2") {
        return sendMessage(
          "Nuestro sistema incluye:\n\n" +
          "✅ Agendamiento automático por WhatsApp\n" +
          "✅ Confirmaciones y recordatorios automáticos\n" +
          "✅ Cancelación y reprogramación sin intervención humana\n" +
          "✅ Panel con métricas reales de ocupación\n\n" +
          "Escribe 1 cuando quieras agendar tu demo.\n\n" +
          "0️⃣ Volver al inicio"
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

    case SALES_STATES.BOOKING_DATE: {

    if (text === "0") {
      await updateConversation(conversation.id, {
        state: SALES_STATES.SHOW_RESULT
      });
      return sendMessage("1️⃣ Agendar demo\n2️⃣ Más info\n3️⃣ Probar demo");
    }

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

    // ✅ Guardar fecha en contexto SIN serviceId
    await updateConversation(conversation.id, {
      state: SALES_STATES.BOOKING_TIME,
      context: { dateISO: selectedDateISO }
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

    if (text === "0") {
      await updateConversation(conversation.id, {
        state: SALES_STATES.BOOKING_DATE
      });
      return sendMessage("Ingresa fecha DD/MM/AAAA");
    }

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

      if (text === "0") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.BOOKING_TIME
        });

        let response = "Horarios disponibles:\n\n";
        conversation.context.availableSlots.forEach((slot, index) => {
          response += `${index + 1}️⃣ ${slot}\n`;
        });

        response += "4️⃣ Necesito otro horario\n\n0️⃣ Volver atrás";
        return sendMessage(response);
      }

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
        clinicId: clinic.id,
        name: text.trim(),
        phone: patientPhone,
        preferredAt: preferredAtUTC
      }
    });

    await closeConversation(conversation.id, SALES_STATES.COMPLETED);

    const date = DateTime.fromISO(
      conversation.context.startAtISO,
      { zone: clinic.timeZone }
    );

    return sendMessage(
  `✅ *Solicitud de demo recibida*\n\n` +
  `Gracias, *${text.trim()}* 🙌\n\n` +
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

    default:
      return sendMessage("Escribe *inicio* para comenzar.");
  }
};

module.exports = {
  handleSalesBotMessage
};