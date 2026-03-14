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

  const regex24 = /^(\d{1,2}):([0-5]\d)$/;
  const match24 = cleaned.match(regex24);

  if (match24) {
    let hour = parseInt(match24[1], 10);
    const minute = match24[2];

    if (hour >= 0 && hour <= 23) {
      return `${hour.toString().padStart(2, "0")}:${minute}`;
    }
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

    // ✅ Si el usuario está dentro de la demo interactiva,
  // delegamos completamente al módulo demo (sin tocar DB)
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
      "👋 Hola, gracias por comunicarte con *Kerbo*.\n\n" +
      "¿Cómo estás?\n\n" +
      "La mayoría de clínicas pierden entre 10% y 25% de ingresos por cancelaciones y ausencias.\n\n" +
      "Con Kerbo-Flow puedes reducir eso automáticamente y tener mayor control sobre tu agenda.\n\n" +
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
        `🗂️ Además, te brinda mayor control y organización sobre tu agenda,\n` +
        `permitiéndote visualizar mejor tus citas y reducir el caos operativo.\n\n` +
        "¿Te gustaría agendar una demo personalizada?\n\n" +
        "1️⃣ Sí, agendar demo\n" +
        "2️⃣ Más información\n" +
        "3️⃣ Probar cómo funciona el agendamiento\n\n" +
        "0️⃣ Volver atrás"
      );
    }

    case SALES_STATES.SHOW_RESULT:

    if (text === "0") {
      return sendMessage(
        `Con aproximadamente ${conversation.context.estimatedVolume} citas al mes,\n\n` +
        `📉 Podrías estar perdiendo alrededor de ${Math.floor(conversation.context.estimatedVolume * ESTIMATED_NO_SHOW_RATE)} citas.\n\n` +
        `📈 Nuestro sistema puede ayudarte a recuperar aproximadamente ${conversation.context.estimatedRecovery} citas mensuales.\n\n` +
        "¿Te gustaría agendar una demo personalizada?\n\n" +
        "1️⃣ Sí, agendar demo\n" +
        "2️⃣ Más información\n" +
        "3️⃣ Probar cómo funciona el agendamiento\n\n" +
        "0️⃣ Volver atrás"
      );
    }

    if (text === "1") {
      await updateConversation(conversation.id, {
        state: SALES_STATES.BOOKING_DATE
      });

      return sendMessage(
        "Perfecto ✅\n\n" +
        "¿Para qué fecha deseas la demo?\n" +
        "Formato: DD/MM/AAAA\n\n" +
        "0️⃣ Volver atrás"
      );
    }

    if (text === "2") {
      return sendMessage(
        "Nuestro sistema incluye:\n\n" +
        "✅ Agendamiento automático por WhatsApp\n" +
        "✅ Confirmaciones y recordatorios automáticos\n" +
        "✅ Cancelación y reprogramación sin intervención humana\n" +
        "✅ Panel con métricas reales de ocupación\n\n" +
        "Escribe 1 cuando quieras agendar tu demo.\n\n" +
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

    case SALES_STATES.BOOKING_DATE: {

      if (text === "0") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.SHOW_RESULT
        });

        return sendMessage(
          "¿Te gustaría agendar una demo personalizada?\n\n" +
          "1️⃣ Sí, agendar demo\n" +
          "2️⃣ Más información\n" +
          "3️⃣ Probar cómo funciona el agendamiento\n\n" +
          "0️⃣ Volver atrás"
        );
      }

      // ✅ Parse seguro usando Luxon directamente
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
        return sendMessage(
          "No puedes agendar una fecha pasada.\n\n" +
          "Por favor elige una fecha futura o el día de hoy.\n\n" +
          "0️⃣ Volver atrás"
        );
      }

      const serviceId = await getDemoServiceId(clinic.id);

      if (!serviceId) {
        return sendMessage("Servicio demo no configurado.");
      }

      let slots = await getAvailableSlotsForDay({
        clinicId: clinic.id,
        serviceId,
        dateISO: selectedDateISO
      });

      if (!slots.length) {
        return sendMessage(
          "No hay horarios disponibles para esa fecha.\n" +
          "Elige otra.\n\n0️⃣ Volver atrás"
        );
      }

      await updateConversation(conversation.id, {
        state: SALES_STATES.BOOKING_TIME,
        context: {
          dateISO: selectedDateISO,
          serviceId,
          availableSlots: slots
        }
      });

      let response = "Estos horarios están disponibles:\n\n";

      slots.forEach((slot, index) => {
        response += `${index + 1}️⃣ ${slot}\n`;
      });

      response +=
        "\nResponde con el número o escribe la hora en formato HH:mm o 2:30pm.\n\n0️⃣ Volver atrás";

      return sendMessage(response);
    }

    case SALES_STATES.ASK_NAME: {

      if (text === "0") {
        await updateConversation(conversation.id, {
          state: SALES_STATES.BOOKING_TIME
        });

        return sendMessage(
          "Responde con el número del horario o escribe la hora en formato HH:mm.\n\n0️⃣ Volver atrás"
        );
      }

      if (!text || text.length < 2) {
        return sendMessage("Por favor indícame tu nombre 😊");
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
          "✅ *Demo confirmada*\n\n" +
          `📅 Fecha: ${date.toFormat("dd/MM/yyyy")}\n` +
          `⏰ Hora: ${date.toFormat("hh:mm a")}\n\n` +
          "📩 Recibirás un recordatorio automático 24 horas antes.\n\n" +
          "El enlace de Google Meet te lo enviaremos antes de comenzar la reunión.\n\n" +
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