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

  const text = message.toLowerCase().trim();

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
        "Escribe *cita* para comenzar a agendar."
      );
  }
};

async function handleIdle({ text, clinic, conversation, sendMessage }) {

  const isBookingIntent = BOOKING_KEYWORDS.some(word =>
    text.includes(word)
  );

  if (!isBookingIntent) {
    return sendMessage(
      "Hola 👋\nSi deseas agendar una cita, escribe *cita*."
    );
  }

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
    dateISO: date.toISOString().split("T")[0] // YYYY-MM-DD limpio
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

  const dateISO = conversation.context.dateISO;

  if (!dateISO) {
    return sendMessage("Error interno de fecha. Intenta nuevamente.");
  }

  // ✅ Construimos ISO limpio SIN crear Date antes
  const startAtISO = `${dateISO}T${time}:00`;

  try {

    await createAppointment({
      clinicId: clinic.id,
      serviceId: conversation.context.serviceId,
      patientName: conversation.patientName,
      patientPhone: conversation.patientPhone,
      startAt: startAtISO, // ✅ enviamos ISO string limpio
    });

    await updateConversation(conversation.id, {
      state: "COMPLETED",
      active: false
    });

    return sendMessage(
      "✅ ¡Cita agendada con éxito!"
    );

  } catch (error) {

    console.error("ERROR REAL AL AGENDAR:", error);

    if (
      error.message === "Time slot not available" ||
      error.message === "Fuera del horario de atención" ||
      error.message === "La clínica no atiende ese día"
    ) {
      return sendMessage(
        error.message + "\nElige otra hora."
      );
    }

    return sendMessage(
      "Ocurrió un error al agendar."
    );
  }
}

function parseTime(text) {
  const regex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(text) ? text : null;
}

module.exports = {
  handleIncomingMessage
};