const {
  getOrCreateConversation,
  updateConversation,
  closeConversation
} = require("./conversation.service");

const { parseDate } = require("../utils/date.utils");
const { getAvailableSlotsForDay } = require("./availability.service");
const { createAppointment } = require("./bookingService");

const prisma = require("../lib/prisma");
const { DateTime } = require("luxon");

const SALES_STATES = {
  IDLE: "SALES_IDLE",
  PROBLEM_HOOK: "SALES_PROBLEM_HOOK",
  ASK_VOLUME: "SALES_ASK_VOLUME",
  SHOW_RESULT: "SALES_SHOW_RESULT",
  BOOKING_DATE: "SALES_BOOKING_DATE",
  BOOKING_TIME: "SALES_BOOKING_TIME",
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

  // ✅ Formato HH:mm (24h)
  const regex24 = /^(\d{1,2}):([0-5]\d)$/;
  const match24 = cleaned.match(regex24);

  if (match24) {
    let hour = parseInt(match24[1], 10);
    const minute = match24[2];

    if (hour >= 0 && hour <= 23) {
      return `${hour.toString().padStart(2, "0")}:${minute}`;
    }
  }

  // ✅ Formato 2pm / 2:30pm / 10am
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
    "La mayoría de clínicas pierden entre 10% y 25% de ingresos por cancelaciones.\n\n" +
    "¿Quieres ver cómo funciona?\n\n" +
    "1️⃣ Sí, muéstrame\n\n" 

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
      "👋 Hola.\n\n" +
      "La mayoría de clínicas pierden entre 10% y 25% de ingresos por cancelaciones y ausencias.\n\n" +
      "Yo ayudo a reducir eso automáticamente.\n\n" +
      "¿Quieres ver cómo funciona?\n\n" +
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
          "¿Cuántas citas gestionas al mes aproximadamente?\n\n" +
          "1️⃣ Menos de 100\n" +
          "2️⃣ 100 - 300\n" +
          "3️⃣ Más de 300"
        );
      }

      return sendMessage("Escribe 1 para continuar.");

    case SALES_STATES.ASK_VOLUME: {

      const volume = getVolumeFromOption(text);

      if (!volume) {
        return sendMessage("Por favor elige una opción válida.");
      }

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
        `📈 Nuestro sistema puede ayudarte a recuperar aproximadamente ${recoverable} citas mensuales.\n\n` +
        "¿Te gustaría agendar una demo personalizada?\n\n" +
        "1️⃣ Sí, agendar demo\n" +
        "2️⃣ Más información\n\n" +
        "0️⃣ Volver al inicio"
      );
    }

    case SALES_STATES.SHOW_RESULT:

    if (text === "1") {
      await updateConversation(conversation.id, {
        state: SALES_STATES.BOOKING_DATE
      });

      return sendMessage(
        "Perfecto ✅\n\n" +
        "¿Para qué fecha deseas la demo?\n" +
        "Formato: DD/MM/AAAA" +
        "\n\n0️⃣ Volver al inicio"
      );
    }

    if (text === "2") {
      return sendMessage(
        "Nuestro sistema incluye:\n\n" +
        "✅ Agendamiento automático por WhatsApp\n" +
        "✅ Confirmaciones y recordatorios automáticos\n" +
        "✅ Cancelación y reprogramación sin intervención humana\n" +
        "✅ Panel con métricas reales de ocupación\n\n" +
        "Escribe 1 cuando quieras agendar tu demo." +
        "\n\n0️⃣ Volver al inicio"
      );
    }

    return sendMessage("Elige una opción válida.");

    case SALES_STATES.BOOKING_DATE: {

      const date = parseDate(text);

      if (!date) {
        return sendMessage("Fecha inválida. Usa formato DD/MM/AAAA");
      }

      const dateISO = date.toISOString().split("T")[0];

      const serviceId = await getDemoServiceId(clinic.id);

      if (!serviceId) {
        return sendMessage("Servicio demo no configurado.");
      }

      let slots = await getAvailableSlotsForDay({
        clinicId: clinic.id,
        serviceId,
        dateISO
      });

      const nowInClinic = DateTime.now().setZone(clinic.timeZone);
      const selectedDate = DateTime.fromISO(dateISO, { zone: clinic.timeZone });

      // ✅ Si es hoy, permitir hora manual directamente
      if (selectedDate.hasSame(nowInClinic, "day")) {

        await updateConversation(conversation.id, {
          state: SALES_STATES.BOOKING_TIME,
          context: {
            dateISO,
            serviceId,
            availableSlots: slots || []
          }
        });

        return sendMessage(
          "Para hoy, escribe la hora deseada en formato HH:mm.\nEjemplo: 16:00"
        );
      }

      if (!slots.length) {
        return sendMessage(
          "No hay horarios disponibles para esa fecha.\nElige otra."
        );
      }

      await updateConversation(conversation.id, {
        state: SALES_STATES.BOOKING_TIME,
        context: {
          dateISO,
          serviceId,
          availableSlots: slots
        }
      });

      let response = "Estos horarios están disponibles:\n\n";

      slots.forEach((slot, index) => {
        response += `${index + 1}️⃣ ${slot}\n`;
      });

      response += "\nResponde con el número o escribe la hora en formato HH:mm.\n\n0️⃣ Volver al inicio";

      return sendMessage(response);
    }

    case SALES_STATES.BOOKING_TIME: {

      let selected = null;

      // ✅ Número
      if (/^\d+$/.test(text)) {
        const index = parseInt(text, 10);
        selected = conversation.context.availableSlots?.[index - 1];
      }

      // ✅ Hora manual
      if (!selected) {
        const manualTime = parseTime(text);
        if (manualTime) {
          selected = manualTime;
        }
      }

      if (!selected) {
        return sendMessage(
          "Responde con el número del horario o escribe la hora en formato HH:mm."
        );
      }

      const startAtISO = `${conversation.context.dateISO}T${selected}:00`;

      await updateConversation(conversation.id, {
        state: SALES_STATES.ASK_NAME,
        context: {
          ...conversation.context,
          startAtISO
        }
      });

      return sendMessage(
        "Perfecto ✅\n\n" +
        "Antes de confirmar la demo,\n" +
        "¿Me indicas tu nombre completo?" +
        "\n\n0️⃣ Volver al inicio"
      );
    }

    case SALES_STATES.ASK_NAME: {

      if (!text || text.length < 2) {
        return sendMessage("Por favor escribe tu nombre completo.");
      }

      try {

        await createAppointment({
          clinicId: clinic.id,
          serviceId: conversation.context.serviceId,
          patientName: message.trim(),
          patientPhone,
          startAt: conversation.context.startAtISO
        });

        await closeConversation(conversation.id, SALES_STATES.COMPLETED);

        const date = DateTime.fromISO(
          conversation.context.startAtISO,
          { zone: clinic.timeZone }
        );

        return sendMessage(
          "✅ Demo confirmada\n\n" +
          `📅 Fecha: ${date.toFormat("dd/MM/yyyy")}\n` +
          `⏰ Hora: ${date.toFormat("hh:mm a")}\n\n` +
          "Recibirás un recordatorio automático.\n\n" +
          "Nos vemos pronto 👋"
        );

      } catch (error) {

        return sendMessage(
          "Ese horario no está disponible o es inválido.\n" +
          "Escribe otra hora en formato HH:mm."
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