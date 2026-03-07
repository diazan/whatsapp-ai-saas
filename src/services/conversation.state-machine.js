const { getAvailableSlotsForDay } = require("./availability.service");
const prisma = require("../lib/prisma");
const { createAppointment } = require("./bookingService");
const { parseDate } = require("../utils/date.utils");
const {
  getOrCreateConversation,
  updateConversation
} = require("./conversation.service");

const BOOKING_KEYWORDS = ["cita", "turno", "agendar", "reservar"];

const handleIncomingMessage = async ({
  clinic,
  message,
  patientPhone,
  patientName,
  sendMessage
}) => {

  const conversation = await getOrCreateConversation({
    clinicId: clinic.id,
    patientPhone,
    patientName
  });

     // ✅ Timeout conversacional usando expiresAt
  const now = new Date();

  if (
    conversation.state !== "IDLE" &&
    conversation.state !== "COMPLETED" &&
    conversation.expiresAt < now
  ) {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      "La conversación anterior expiró por inactividad.\n\nEscribe *inicio* para comenzar nuevamente."
    );
  }

  const text = message.toLowerCase().trim();

  // ✅ Reinicio manual si escribe hola
  if (text === "hola" || text === "inicio") {

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      "Hola 👋\n\n" +
      "¿Qué deseas hacer?\n\n" +
      "1️⃣ Agendar cita\n" +
      "2️⃣ Cancelar cita\n" +
      "3️⃣ Ver mi próxima cita"
    );
  }


  // ✅ Reinicio forzado si vuelve a escribir palabra clave
  const isBookingIntent = BOOKING_KEYWORDS.some(word =>
    text.includes(word)
  );

  if (isBookingIntent && conversation.state !== "IDLE") {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });
  }

  switch (conversation.state) {

    case "IDLE":
      return handleIdle({ text, clinic, conversation, sendMessage });

    case "WAITING_SERVICE":
      return handleServiceSelection({ text, clinic, conversation, sendMessage });

    case "WAITING_DATE":
      return handleDateSelection({ text, conversation, sendMessage });

    case "WAITING_TIME":
      return handleTimeSelection({ text, clinic, conversation, sendMessage });

    default:
      return sendMessage(
        "Escribe *inicio* para comenzar a agendar."
      );
  }

};

async function handleIdle({ text, clinic, conversation, sendMessage }) {

  if (text !== "1" && text !== "2" && text !== "3") {
    return sendMessage(
      "Hola 👋\n\n" +
      "¿Qué deseas hacer?\n\n" +
      "1️⃣ Agendar cita\n" +
      "2️⃣ Cancelar cita\n" +
      "3️⃣ Ver mi próxima cita"
    );
  }

  // ✅ Opción 1 - Agendar
  if (text === "1") {
    const services = await prisma.service.findMany({
      where: {
        clinicId: clinic.id,
        active: true
      }
    });

    if (!services.length) {
      return sendMessage(
        "No hay servicios disponibles actualmente."
      );
    }

    let response = "¿Qué servicio deseas agendar?\n\n";

    services.forEach((service, index) => {
      response += `${index + 1}️⃣ ${service.name}\n`;
    });

    await updateConversation(conversation.id, {
      state: "WAITING_SERVICE",
      context: {}
    });

    return sendMessage(response);
  }

  // ✅ Opción 2 - Cancelar
  if (text === "2") {

    const cancelled = await cancelNextAppointment({
      clinicId: clinic.id,
      patientPhone: conversation.patientPhone
    });

    if (!cancelled) {
      return sendMessage(
        "No tienes citas próximas para cancelar."
      );
    }

    return sendMessage(
      "✅ Tu cita ha sido cancelada correctamente."
    );
  }

  // ✅ Opción 3 - Ver próxima cita
  if (text === "3") {

    const now = new Date();

    const appointment = await prisma.appointment.findFirst({
      where: {
        clinicId: clinic.id,
        patientPhone: conversation.patientPhone,
        status: {
          in: ["scheduled", "confirmed"]
        },
        startAt: {
          gte: now
        }
      },
      orderBy: {
        startAt: "asc"
      }
    });

    if (!appointment) {
      return sendMessage(
        "No tienes citas próximas."
      );
    }

    const { DateTime } = require("luxon");

    const dateTime = DateTime.fromJSDate(appointment.startAt)
      .setZone(clinic.timeZone);

    const formattedDate = dateTime.toFormat("dd/MM/yyyy");
    const formattedTime = dateTime.toFormat("hh:mm a");

    return sendMessage(
      `📅 Tu próxima cita:\n\n` +
      `Fecha: ${formattedDate}\n` +
      `Hora: ${formattedTime}`
    );
  }
}

async function handleServiceSelection({ text, clinic, conversation, sendMessage }) {

  const index = parseInt(text);

  if (isNaN(index)) {
    return sendMessage(
      "Por favor responde con el número del servicio."
    );
  }

  const services = await prisma.service.findMany({
    where: {
      clinicId: clinic.id,
      active: true
    }
  });

  const selectedService = services[index - 1];

  if (!selectedService) {
    return sendMessage(
      "Opción inválida. Intenta nuevamente."
    );
  }

  await updateConversation(conversation.id, {
    state: "WAITING_DATE",
    context: {
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      durationMin: selectedService.durationMin
    }
  });

  return sendMessage(
    `Perfecto ✅\n\nHas elegido: ${selectedService.name}\n\n` +
    `¿Para qué fecha deseas la cita?\n` +
    `Formato: DD/MM/AAAA`
  );
}

async function handleDateSelection({ text, conversation, sendMessage }) {

  const date = parseDate(text);

  if (!date) {
    return sendMessage(
      "Fecha inválida.\nUsa formato DD/MM/AAAA"
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return sendMessage(
      "No puedes agendar en una fecha pasada."
    );
  }

  const updatedContext = {
    ...conversation.context,
    dateISO: date.toISOString().split("T")[0]
  };

  await updateConversation(conversation.id, {
    state: "WAITING_TIME",
    context: updatedContext
  });

  return sendMessage(
    "Perfecto ✅\n\n¿A qué hora deseas la cita?\nFormato: HH:mm"
  );
}

async function handleTimeSelection({ text, clinic, conversation, sendMessage }) {

  const time = parseTime(text);

  if (!time) {
    return sendMessage(
      "Hora inválida.\nUsa formato HH:mm"
    );
  }

  const dateISO = conversation.context?.dateISO;

  if (!dateISO) {
    return sendMessage("Error interno de fecha. Escribe *cita* para empezar de nuevo.");
  }

  const startAtISO = `${dateISO}T${time}:00`;

  try {

    console.log("CONVERSATION EN TIME:", conversation);
    console.log("CONTEXT FINAL:", conversation.context);

    await createAppointment({
      clinicId: clinic.id,
      serviceId: conversation.context.serviceId,
      patientName: conversation.patientName || "Paciente",
      patientPhone: conversation.patientPhone,
      startAt: startAtISO,
    });

    await updateConversation(conversation.id, {
      state: "COMPLETED",
      active: false
    });

    const serviceName = conversation.context.serviceName;
    const dateISO = conversation.context.dateISO;

    // Formatear fecha DD/MM/AAAA
    const [year, month, day] = dateISO.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    // Formatear hora a AM/PM
    const [hourStr, minute] = text.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";

    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;

    const formattedTime = `${hour}:${minute} ${ampm}`;

    return sendMessage(
      `✅ *Cita confirmada*\n\n` +
      `🦷 Servicio: ${serviceName}\n` +
      `📅 Fecha: ${formattedDate}\n` +
      `⏰ Hora: ${formattedTime}\n\n` +
      `Te esperamos.`
    );

    } catch (error) {

      console.error("ERROR REAL AL AGENDAR:", error.message);

      if (error.message === "Time slot not available") {

        const suggestions = await getAvailableSlotsForDay({
          clinicId: clinic.id,
          serviceId: conversation.context.serviceId,
          dateISO: conversation.context.dateISO
        });

        if (suggestions.length) {
          return sendMessage(
            "Ese horario no está disponible.\n\n" +
            "Estos horarios están libres:\n" +
            suggestions.join("\n") +
            "\n\nEscribe uno en formato HH:mm"
          );
        }

        return sendMessage(
          "Ese horario no está disponible.\nElige otra hora."
        );
      }

      if (error.message === "Cannot book in the past") {
        return sendMessage(
          "No puedes agendar en una hora pasada.\nElige otra hora."
        );
      }

      if (
        error.message === "Fuera del horario de atención" ||
        error.message === "La clínica no atiende ese día"
      ) {
        return sendMessage(
          error.message + "\nElige otra hora."
        );
      }

      if (
        error.message === "Invalid date format" ||
        error.message === "Missing required booking data"
      ) {
        return sendMessage(
          "Hubo un problema con la hora.\nEscríbela nuevamente en formato HH:mm"
        );
      }

      return sendMessage(
        "Ocurrió un error al agendar.\nEscribe *inicio* para comenzar nuevamente."
      );
    }
}

function parseTime(text) {
  const regex = /^(\d{1,2}):([0-5]\d)$/;

  const match = text.match(regex);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2];

  if (hour < 0 || hour > 23) return null;

  // Normalizar a formato HH:mm
  const normalizedHour = hour.toString().padStart(2, "0");

  return `${normalizedHour}:${minute}`;
}

module.exports = {
  handleIncomingMessage
};