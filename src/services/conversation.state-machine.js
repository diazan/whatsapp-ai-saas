const { getAvailableSlotsForDay } = require("./availability.service");
const prisma = require("../lib/prisma");
const { createAppointment, rescheduleAppointment } = require("./bookingService");
const { parseDate } = require("../utils/date.utils");
const {
  getOrCreateConversation,
  updateConversation
} = require("./conversation.service");
const { evaluateClinicNotification } = require("./clinicNotificationService");

const BOOKING_KEYWORDS = ["cita", "turno", "agendar", "reservar"];

const { handleSalesBot } = require("./salesBot.service");

// ✅ Testimonios hardcodeados — Fase 1
// En Fase 2: vendrán de DB + respetarán clinic.showTestimonials
const TESTIMONIALS = [
  { text: "Excelente atención, todo fue muy rápido y profesional.", author: "María G." },
  { text: "Agendé por WhatsApp y fue súper fácil. 100% recomendado.", author: "Carlos R." },
  { text: "Me atendieron el mismo día. Muy amables y puntuales.", author: "Laura M." }
];

// ✅ Control de visibilidad — Fase 2: vendrá de clinic.showTestimonials
const SHOW_TESTIMONIALS = true;

// ─────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────

const handleIncomingMessage = async ({
  clinic,
  message,
  patientPhone,
  patientName,
  sendMessage
}) => {

  // ✅ Separación por tipo de clínica
  if (clinic.type === "SALES") {
    return handleSalesBot({
      clinic,
      message,
      patientPhone,
      patientName,
      sendMessage
    });
  }

  const conversation = await getOrCreateConversation({
    clinicId: clinic.id,
    patientPhone,
    patientName
  });

  // ✅ Conversación expirada
  if (conversation.expired) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        active: false,
        state: "CANCELLED"
      }
    });

    return sendMessage(
      "La conversación anterior expiró por inactividad.\n\n" +
      "Escribe *inicio* para comenzar nuevamente."
    );
  }

  const now = new Date();

  // ✅ Timeout conversacional
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
      "La conversación anterior expiró por inactividad.\n\n" +
      "Escribe *inicio* para comenzar nuevamente."
    );
  }

  const text = message.toLowerCase().trim();

  // ✅ Escape global al menú principal
  if (text === "0") {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(buildMainMenu(clinic));
  }

  // ✅ Saludo inicial
  if (text === "hola" || text === "inicio") {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(buildMainMenu(clinic));
  }

  // ✅ Reinicio forzado si escribe keyword de booking
  const isBookingIntent = BOOKING_KEYWORDS.some(word => text.includes(word));

  if (isBookingIntent && conversation.state !== "IDLE") {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });
  }

  switch (conversation.state) {

    case "IDLE":
      return handleIdle({ text, clinic, conversation, sendMessage });

    case "WAITING_SUBMENU_CITAS":
      return handleSubmenuCitas({ text, clinic, conversation, sendMessage });

    case "WAITING_SERVICE":
      return handleServiceSelection({ text, clinic, conversation, sendMessage });

    case "WAITING_DATE":
      return handleDateSelection({ text, conversation, sendMessage });

    case "WAITING_REMINDER_RESPONSE":
      return handleReminderResponse({ text, clinic, conversation, sendMessage });

    case "WAITING_NAME":
      return handleNameCollection({ text, conversation, sendMessage });

    case "WAITING_TIME":
      return handleTimeSelection({ text, clinic, conversation, sendMessage });

    case "WAITING_RESCHEDULE_DATE":
      return handleRescheduleDate({ text, clinic, conversation, sendMessage });

    case "WAITING_RESCHEDULE_TIME":
      return handleRescheduleTime({ text, clinic, conversation, sendMessage });

    case "WAITING_CANCEL_CONFIRMATION":
      return handleCancelConfirmation({ text, clinic, conversation, sendMessage });

    case "WAITING_RESCHEDULE_CONFIRMATION":
      return handleRescheduleConfirmation({ text, clinic, conversation, sendMessage });

    case "WAITING_RESCHEDULE_SELECTION":
      return handleRescheduleSelection({ text, clinic, conversation, sendMessage });

    case "WAITING_CANCEL_SELECTION":
      return handleCancelSelection({ text, clinic, conversation, sendMessage });

    case "WAITING_VIEW_OTHER_APPOINTMENTS":
      return handleViewOtherAppointments({ clinic, conversation, sendMessage });

    case "WAITING_ADVISOR_QUESTION":
      return handleAdvisorQuestion({ text, clinic, conversation, patientPhone, sendMessage });

    default:
      return sendMessage(
        "Escribe *inicio* para comenzar."
      );
  }
};

// ─────────────────────────────────────────────
// BUILDERS
// ─────────────────────────────────────────────

function buildMainMenu(clinic) {
  const name = clinic.name || "nuestra clínica";

  let menu =
    `👋 Hola, soy el asistente virtual de *${name}*\n\n` +
    `¿En qué puedo ayudarte hoy?\n\n` +
    `1️⃣ 📅 Citas\n` +
    `2️⃣ 🦷 Nuestros servicios\n` +
    `3️⃣ 🔥 Promociones activas\n`;

  if (SHOW_TESTIMONIALS) {
    menu += `4️⃣ ⭐ Testimonios de pacientes\n`;
    menu += `5️⃣ 📍 Ubicación y horarios\n`;
    menu += `6️⃣ 💬 Hablar con un asesor\n`;
  } else {
    menu += `4️⃣ 📍 Ubicación y horarios\n`;
    menu += `5️⃣ 💬 Hablar con un asesor\n`;
  }

  menu += `\n✨ Agenda tu cita en menos de 2 minutos`;

  return menu;
}

function buildSubmenuCitas() {
  return (
    `📅 *Gestión de citas*\n\n` +
    `¿Qué deseas hacer?\n\n` +
    `1️⃣ Agendar cita\n` +
    `2️⃣ Ver mi próxima cita\n` +
    `3️⃣ Reprogramar cita\n` +
    `4️⃣ Cancelar cita\n\n` +
    `0️⃣ Volver al menú principal`
  );
}

function appendMainMenuOption(text) {
  return `${text}\n\n0️⃣ Volver al menú principal`;
}

// ─────────────────────────────────────────────
// HANDLERS — MENÚ PRINCIPAL
// ─────────────────────────────────────────────

async function handleIdle({ text, clinic, conversation, sendMessage }) {

  // ✅ Determinar opciones válidas según SHOW_TESTIMONIALS
  const validOptions = SHOW_TESTIMONIALS
    ? ["1", "2", "3", "4", "5", "6"]
    : ["1", "2", "3", "4", "5"];

  if (!validOptions.includes(text)) {
    return sendMessage(buildMainMenu(clinic));
  }

  // ✅ Opción 1 — Citas (submenú)
  if (text === "1") {
    await updateConversation(conversation.id, {
      state: "WAITING_SUBMENU_CITAS",
      context: {}
    });

    return sendMessage(buildSubmenuCitas());
  }

  // ✅ Opción 2 — Ver servicios
  if (text === "2") {
    const services = await prisma.service.findMany({
      where: {
        clinicId: clinic.id,
        active: true
      },
      orderBy: { displayOrder: "asc" }
    });

    if (!services.length) {
      return sendMessage(
        appendMainMenuOption(
          "🦷 Actualmente no tenemos servicios registrados.\n" +
          "Contáctanos para más información."
        )
      );
    }

    let response = `🦷 *Nuestros servicios*\n\n`;
    services.forEach((service) => {
      response += `• ${service.name}`;
      if (service.durationMin) {
        response += ` (${service.durationMin} min)`;
      }
      response += `\n`;
    });

    response += `\n¿Te gustaría agendar alguno?`;

    return sendMessage(
      appendMainMenuOption(response)
    );
  }

  // ✅ Opción 3 — Promociones
  if (text === "3") {
    // Fase 1: placeholder — Fase 2: clinic.promotions
    const promotions =
      clinic.promotions ||
      "🔥 Escríbenos para conocer nuestras promociones activas.\n" +
      "¡Tenemos ofertas especiales disponibles!";

    return sendMessage(
      appendMainMenuOption(
        `🔥 *Promociones activas*\n\n${promotions}`
      )
    );
  }

  // ✅ Opción 4 — Testimonios (si está activo) o Ubicación
  if (text === "4") {
    if (SHOW_TESTIMONIALS) {
      return handleTestimonials({ conversation, sendMessage });
    } else {
      return handleLocationAndHours({ clinic, sendMessage });
    }
  }

  // ✅ Opción 5 — Ubicación y horarios (si testimonios activo) o Asesor
  if (text === "5") {
    if (SHOW_TESTIMONIALS) {
      return handleLocationAndHours({ clinic, sendMessage });
    } else {
      return handleStartAdvisor({ conversation, sendMessage });
    }
  }

  // ✅ Opción 6 — Hablar con asesor (solo si testimonios activo)
  if (text === "6" && SHOW_TESTIMONIALS) {
    return handleStartAdvisor({ conversation, sendMessage });
  }
}

// ─────────────────────────────────────────────
// HANDLERS — NUEVAS OPCIONES
// ─────────────────────────────────────────────

async function handleTestimonials({ conversation, sendMessage }) {

  let response = `⭐ *Testimonios de nuestros pacientes*\n\n`;

  TESTIMONIALS.forEach((t) => {
    response += `💬 _"${t.text}"_\n`;
    response += `— ${t.author}\n\n`;
  });

  response += `¿Listo para tu cita?`;

  return sendMessage(
    appendMainMenuOption(response)
  );
}

async function handleLocationAndHours({ clinic, sendMessage }) {

  // Fase 1: placeholders — Fase 2: clinic.address + clinic.businessHours
  const address =
    clinic.address ||
    "📍 Consulta nuestra dirección escribiendo al asesor.";

  const businessHours =
    clinic.businessHours ||
    "🕐 Lunes a viernes: 8:00 AM - 6:00 PM";

  return sendMessage(
    appendMainMenuOption(
      `📍 *Ubicación y horarios*\n\n` +
      `${address}\n\n` +
      `🕐 *Horarios de atención*\n` +
      `${businessHours}`
    )
  );
}

async function handleStartAdvisor({ conversation, sendMessage }) {

  await updateConversation(conversation.id, {
    state: "WAITING_ADVISOR_QUESTION",
    context: {}
  });

  return sendMessage(
    appendMainMenuOption(
      `💬 *Hablar con un asesor*\n\n` +
      `Por favor escribe tu consulta y la enviaremos a nuestro equipo.\n\n` +
      `Te responderemos a la brevedad 🙏`
    )
  );
}

async function handleAdvisorQuestion({
  text,
  clinic,
  conversation,
  patientPhone,
  sendMessage
}) {

  // ✅ Notificar al admin con la pregunta
  await evaluateClinicNotification({
    phone: patientPhone,
    clinic,
    incomingMessage: text,
    conversationState: "ADVISOR_DIRECT"
  });

  // ✅ Volver a IDLE después de recibir la consulta
  await updateConversation(conversation.id, {
    state: "IDLE",
    context: {}
  });

  return sendMessage(
    appendMainMenuOption(
      `✅ Tu consulta fue enviada a nuestro equipo.\n\n` +
      `Te responderemos a la brevedad.\n\n` +
      `¿Hay algo más en lo que pueda ayudarte?`
    )
  );
}

// ─────────────────────────────────────────────
// HANDLER — SUBMENÚ CITAS
// ─────────────────────────────────────────────

async function handleSubmenuCitas({ text, clinic, conversation, sendMessage }) {

  if (!["1", "2", "3", "4"].includes(text)) {
    return sendMessage(buildSubmenuCitas());
  }

  // ✅ 1 — Agendar cita
  if (text === "1") {
    const services = await prisma.service.findMany({
      where: {
        clinicId: clinic.id,
        active: true
      },
      orderBy: { displayOrder: "asc" }
    });

    if (!services.length) {
      return sendMessage(
        appendMainMenuOption(
          "No hay servicios disponibles actualmente."
        )
      );
    }

    let response = `🦷 *¿Qué servicio deseas agendar?*\n\n`;

    services.forEach((service, index) => {
      response += `${index + 1}️⃣ ${service.name}\n`;
    });

    await updateConversation(conversation.id, {
      state: "WAITING_SERVICE",
      context: {}
    });

    return sendMessage(appendMainMenuOption(response));
  }

  // ✅ 2 — Ver próxima cita
  if (text === "2") {
    return handleVerCita({ clinic, conversation, sendMessage });
  }

  // ✅ 3 — Reprogramar
  if (text === "3") {
    return handleIniciarReprogramar({ clinic, conversation, sendMessage });
  }

  // ✅ 4 — Cancelar
  if (text === "4") {
    return handleIniciarCancelar({ clinic, conversation, sendMessage });
  }
}

// ─────────────────────────────────────────────
// HANDLERS — GESTIÓN DE CITAS (existentes refactorizados)
// ─────────────────────────────────────────────

async function handleVerCita({ clinic, conversation, sendMessage }) {

  const now = new Date();

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      patientPhone: conversation.patientPhone,
      status: { in: ["scheduled", "confirmed"] },
      startAt: { gte: now }
    },
    include: { service: true },
    orderBy: { startAt: "asc" }
  });

  if (!appointments.length) {
    return sendMessage(
      appendMainMenuOption("No tienes citas próximas.")
    );
  }

  const { DateTime } = require("luxon");
  const nextAppointment = appointments[0];
  const dateTime = DateTime.fromJSDate(nextAppointment.startAt).setZone(clinic.timeZone);

  let response =
    `📅 *Tu próxima cita*\n\n` +
    `👤 Paciente: ${nextAppointment.patientName}\n` +
    `🦷 Servicio: ${nextAppointment.service.name}\n` +
    `📆 Fecha: ${dateTime.toFormat("dd/MM/yyyy")}\n` +
    `⏰ Hora: ${dateTime.toFormat("hh:mm a")}`;

  if (appointments.length > 1) {
    await updateConversation(conversation.id, {
      state: "WAITING_VIEW_OTHER_APPOINTMENTS",
      context: {
        remainingAppointments: appointments.slice(1).map(a => ({
          id: a.id,
          serviceName: a.service.name,
          startAt: a.startAt
        }))
      }
    });

    response += `\n\n1️⃣ Ver otras citas`;
    return sendMessage(appendMainMenuOption(response));
  }

  return sendMessage(appendMainMenuOption(response));
}

async function handleIniciarReprogramar({ clinic, conversation, sendMessage }) {

  const now = new Date();

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      patientPhone: conversation.patientPhone,
      status: { in: ["scheduled", "confirmed"] },
      startAt: { gte: now }
    },
    include: { service: true },
    orderBy: { startAt: "asc" }
  });

  if (!appointments.length) {
    return sendMessage(
      appendMainMenuOption("No tienes citas próximas para reprogramar.")
    );
  }

  if (appointments.length === 1) {
    const appointment = appointments[0];

    await updateConversation(conversation.id, {
      state: "WAITING_RESCHEDULE_DATE",
      context: {
        appointmentId: appointment.id,
        serviceId: appointment.serviceId,
        serviceName: appointment.service.name,
        durationMin: appointment.service.durationMin
      }
    });

    return sendMessage(
      appendMainMenuOption(
        `Vas a reprogramar tu cita de *${appointment.service.name}*.\n\n` +
        `¿Para qué nueva fecha?\nFormato: DD/MM/AAAA`
      )
    );
  }

  const { DateTime } = require("luxon");
  let response = `📅 *Tus citas próximas*\n\n`;

  appointments.forEach((appt, index) => {
    const dateTime = DateTime.fromJSDate(appt.startAt).setZone(clinic.timeZone);
    response +=
      `${index + 1}️⃣ ${appt.service.name} - ` +
      `${dateTime.toFormat("dd/MM/yyyy")} ` +
      `${dateTime.toFormat("hh:mm a")}\n`;
  });

  response += `\nResponde con el número de la cita que deseas reprogramar.`;

  await updateConversation(conversation.id, {
    state: "WAITING_RESCHEDULE_SELECTION",
    context: {
      appointmentsList: appointments.map(a => ({
        id: a.id,
        serviceId: a.serviceId,
        serviceName: a.service.name,
        durationMin: a.service.durationMin
      }))
    }
  });

  return sendMessage(appendMainMenuOption(response));
}

async function handleIniciarCancelar({ clinic, conversation, sendMessage }) {

  const now = new Date();

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      patientPhone: conversation.patientPhone,
      status: { in: ["scheduled", "confirmed"] },
      startAt: { gte: now }
    },
    include: { service: true },
    orderBy: { startAt: "asc" }
  });

  if (!appointments.length) {
    return sendMessage(
      appendMainMenuOption("No tienes citas próximas para cancelar.")
    );
  }

  if (appointments.length === 1) {
    const appointment = appointments[0];
    const { DateTime } = require("luxon");
    const dateTime = DateTime.fromJSDate(appointment.startAt).setZone(clinic.timeZone);

    await updateConversation(conversation.id, {
      state: "WAITING_CANCEL_CONFIRMATION",
      context: { appointmentId: appointment.id }
    });

    return sendMessage(
      appendMainMenuOption(
        `Estás a punto de cancelar tu cita:\n\n` +
        `📆 Fecha: ${dateTime.toFormat("dd/MM/yyyy")}\n` +
        `⏰ Hora: ${dateTime.toFormat("hh:mm a")}\n\n` +
        `¿Deseas confirmar?\n\n` +
        `1️⃣ Sí, cancelar cita\n` +
        `2️⃣ No, volver al menú`
      )
    );
  }

  const { DateTime } = require("luxon");
  let response = `📅 *Tus citas próximas*\n\n`;

  appointments.forEach((appt, index) => {
    const dateTime = DateTime.fromJSDate(appt.startAt).setZone(clinic.timeZone);
    response +=
      `${index + 1}️⃣ ${appt.service.name} - ` +
      `${dateTime.toFormat("dd/MM/yyyy")} ` +
      `${dateTime.toFormat("hh:mm a")}\n`;
  });

  response += `\nResponde con el número de la cita que deseas cancelar.`;

  await updateConversation(conversation.id, {
    state: "WAITING_CANCEL_SELECTION",
    context: {
      appointmentsList: appointments.map(a => ({ id: a.id }))
    }
  });

  return sendMessage(appendMainMenuOption(response));
}

// ─────────────────────────────────────────────
// HANDLERS — FLUJO DE AGENDAMIENTO (sin cambios)
// ─────────────────────────────────────────────

async function handleServiceSelection({ text, clinic, conversation, sendMessage }) {

  const index = Number(text);

  if (isNaN(index)) {
    return sendMessage("Por favor responde con el número del servicio.");
  }

  const services = await prisma.service.findMany({
    where: { clinicId: clinic.id, active: true },
    orderBy: { displayOrder: "asc" }
  });

  const selectedService = services[index - 1];

  if (!selectedService) {
    return sendMessage(
      appendMainMenuOption("Opción inválida. Intenta nuevamente.")
    );
  }

  await updateConversation(conversation.id, {
    state: "WAITING_NAME",
    context: {
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      durationMin: selectedService.durationMin
    }
  });

  return sendMessage(
    appendMainMenuOption(
      `Perfecto ✅\n\nHas elegido: *${selectedService.name}*\n\n` +
      `¿A nombre de quién agendamos la cita?`
    )
  );
}

async function handleNameCollection({ text, conversation, sendMessage }) {

  const name = text.trim();

  if (!name || name.length < 2) {
    return sendMessage(
      appendMainMenuOption("Por favor ingresa un nombre válido.")
    );
  }

  if (name.length > 100) {
    return sendMessage(
      appendMainMenuOption("El nombre es demasiado largo. Intenta nuevamente.")
    );
  }

  await updateConversation(conversation.id, {
    state: "WAITING_DATE",
    context: {
      ...conversation.context,
      patientName: capitalizeName(name)
    }
  });

  return sendMessage(
    appendMainMenuOption(
      `Gracias 😊\n\n` +
      `¿Para qué fecha deseas la cita?\n` +
      `Formato: DD/MM/AAAA`
    )
  );
}

async function handleDateSelection({ text, conversation, sendMessage }) {

  const date = parseDate(text);

  if (!date) {
    return sendMessage("Fecha inválida.\nUsa formato DD/MM/AAAA");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return sendMessage(
      appendMainMenuOption(
        "No puedes agendar en una fecha pasada.\nElige otra fecha."
      )
    );
  }

  await updateConversation(conversation.id, {
    state: "WAITING_TIME",
    context: {
      ...conversation.context,
      dateISO: date.toISOString().split("T")[0]
    }
  });

  return sendMessage(
    appendMainMenuOption(
      "Perfecto ✅\n\n¿A qué hora deseas la cita?\nFormato: HH:mm"
    )
  );
}

async function handleTimeSelection({ text, clinic, conversation, sendMessage }) {

  if (/^\d+$/.test(text) && conversation.context.availableSlots) {
    const index = parseInt(text, 10);
    const selected = conversation.context.availableSlots[index - 1];
    if (!selected) {
      return sendMessage("Opción inválida. Elige un número válido.");
    }
    text = selected;
  }

  const time = parseTime(text);

  if (!time) {
    return sendMessage(
      appendMainMenuOption("Hora inválida.\nUsa formato HH:mm")
    );
  }

  const dateISO = conversation.context?.dateISO;

  if (!dateISO) {
    return sendMessage(
      "Error interno de fecha. Escribe *inicio* para empezar de nuevo."
    );
  }

  const startAtISO = `${dateISO}T${time}:00`;

  try {

    await createAppointment({
      clinicId: clinic.id,
      serviceId: conversation.context.serviceId,
      patientName: conversation.context.patientName
                || conversation.patientName
                || "Paciente",
      patientPhone: conversation.patientPhone,
      startAt: startAtISO
    });

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    const serviceName = conversation.context.serviceName;
    const [year, month, day] = dateISO.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    const [hourStr, minute] = time.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;
    const formattedTime = `${hour}:${minute} ${ampm}`;

    const confirmedName = capitalizeName(
      conversation.context.patientName || conversation.patientName || "Paciente"
    );

    return sendMessage(
      `✅ *Cita confirmada*\n\n` +
      `👤 Paciente: ${confirmedName}\n` +
      `🦷 Servicio: ${serviceName}\n` +
      `📅 Fecha: ${formattedDate}\n` +
      `⏰ Hora: ${formattedTime}\n\n` +
      `0️⃣ Volver al menú principal`
    );

  } catch (error) {

    console.error("ERROR AL AGENDAR:", error.message);

    if (error.message === "Time slot not available") {
      const suggestions = await getAvailableSlotsForDay({
        clinicId: clinic.id,
        serviceId: conversation.context.serviceId,
        dateISO: conversation.context.dateISO
      });

      if (suggestions.length) {
        return sendMessage(
          appendMainMenuOption(
            "Ese horario no está disponible.\n\n" +
            "Estos horarios están libres:\n" +
            suggestions.join("\n") +
            "\n\nEscribe uno en formato HH:mm"
          )
        );
      }

      return sendMessage(
        appendMainMenuOption("Ese horario no está disponible.\nElige otra hora.")
      );
    }

    if (error.message === "Cannot book in the past") {
      return sendMessage(
        appendMainMenuOption(
          "No puedes agendar en una hora pasada.\nElige otra hora."
        )
      );
    }

    if (
      error.message === "Fuera del horario de atención" ||
      error.message === "La clínica no atiende ese día"
    ) {
      return sendMessage(
        appendMainMenuOption(error.message + "\nElige otra hora.")
      );
    }

    return sendMessage(
      "Ocurrió un error al agendar.\nEscribe *inicio* para comenzar nuevamente."
    );
  }
}

// ─────────────────────────────────────────────
// HANDLERS — REPROGRAMAR (sin cambios)
// ─────────────────────────────────────────────

async function handleRescheduleDate({ text, clinic, conversation, sendMessage }) {

  const date = parseDate(text);

  if (!date) {
    return sendMessage(
      appendMainMenuOption("Fecha inválida.\nUsa formato DD/MM/AAAA")
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return sendMessage(
      appendMainMenuOption("No puedes elegir una fecha pasada.")
    );
  }

  const updatedContext = {
    ...conversation.context,
    dateISO: date.toISOString().split("T")[0]
  };

  const slots = await getAvailableSlotsForDay({
    clinicId: clinic.id,
    serviceId: conversation.context.serviceId,
    dateISO: updatedContext.dateISO
  });

  if (!slots.length) {
    return sendMessage(
      appendMainMenuOption(
        "No hay horarios disponibles para esa fecha.\nElige otra fecha."
      )
    );
  }

  const limitedSlots = slots.slice(0, 8);
  let response = `Estos horarios están disponibles:\n\n`;

  limitedSlots.forEach((slot, index) => {
    response += `${index + 1}️⃣ ${slot}\n`;
  });

  response += `\nResponde con el número o escribe la hora (ej: 2pm).`;

  await updateConversation(conversation.id, {
    state: "WAITING_RESCHEDULE_TIME",
    context: { ...updatedContext, availableSlots: limitedSlots }
  });

  return sendMessage(appendMainMenuOption(response));
}

async function handleRescheduleTime({ text, clinic, conversation, sendMessage }) {

  if (/^\d+$/.test(text) && conversation.context.availableSlots) {
    const index = parseInt(text, 10);
    const selected = conversation.context.availableSlots[index - 1];
    if (!selected) {
      return sendMessage(
        appendMainMenuOption("Opción inválida. Elige un número válido.")
      );
    }
    text = selected;
  }

  const time = parseTime(text);

  if (!time) {
    return sendMessage(
      appendMainMenuOption("Hora inválida.\nUsa formato HH:mm")
    );
  }

  const dateISO = conversation.context.dateISO;
  const startAtISO = `${dateISO}T${time}:00`;

  await updateConversation(conversation.id, {
    state: "WAITING_RESCHEDULE_CONFIRMATION",
    context: { ...conversation.context, newStartAtISO: startAtISO }
  });

  const { DateTime } = require("luxon");
  const dateTime = DateTime.fromISO(startAtISO, { zone: clinic.timeZone });

  return sendMessage(
    appendMainMenuOption(
      `Vas a reprogramar tu cita:\n\n` +
      `📅 Nueva fecha: ${dateTime.toFormat("dd/MM/yyyy")}\n` +
      `⏰ Nueva hora: ${dateTime.toFormat("hh:mm a")}\n\n` +
      `¿Deseas confirmar?\n\n` +
      `1️⃣ Confirmar reprogramación\n` +
      `2️⃣ Cancelar operación`
    )
  );
}

async function handleRescheduleConfirmation({ text, clinic, conversation, sendMessage }) {

  if (text === "1") {
    const { appointmentId, serviceId, newStartAtISO } = conversation.context;

    if (!newStartAtISO) {
      return sendMessage(
        "Ocurrió un error con la nueva fecha.\nEscribe *inicio* para comenzar nuevamente."
      );
    }

    try {
      await rescheduleAppointment({
        appointmentId,
        clinicId: clinic.id,
        serviceId,
        newStartAt: newStartAtISO
      });

      await updateConversation(conversation.id, {
        state: "IDLE",
        context: {}
      });

      const { DateTime } = require("luxon");
      const dateTime = DateTime.fromISO(newStartAtISO, { zone: clinic.timeZone });

      return sendMessage(
        `✅ Tu cita ha sido reprogramada\n\n` +
        `📅 Fecha: ${dateTime.toFormat("dd/MM/yyyy")}\n` +
        `⏰ Hora: ${dateTime.toFormat("hh:mm a")}\n\n` +
        `0️⃣ Volver al menú principal`
      );

    } catch (error) {
      if (error.message === "Time slot not available") {
        return sendMessage(
          appendMainMenuOption("Ese horario ya no está disponible.\nElige otro.")
        );
      }
      console.error("RESCHEDULE CONFIRM ERROR:", error.message);
      return sendMessage(
        "Ocurrió un error.\nEscribe *inicio* para comenzar nuevamente."
      );
    }
  }

  if (text === "2") {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      `Operación cancelada ✅\n\n0️⃣ Volver al menú principal`
    );
  }

  return sendMessage(
    "Responde:\n\n" +
    "1️⃣ Confirmar reprogramación\n" +
    "2️⃣ Cancelar operación"
  );
}

async function handleRescheduleSelection({ text, clinic, conversation, sendMessage }) {

  const index = parseInt(text, 10);

  if (isNaN(index)) {
    return sendMessage(
      appendMainMenuOption(
        "Por favor responde con el número de la cita que deseas reprogramar."
      )
    );
  }

  const selected = conversation.context.appointmentsList[index - 1];

  if (!selected) {
    return sendMessage(
      appendMainMenuOption("Opción inválida. Elige un número válido.")
    );
  }

  await updateConversation(conversation.id, {
    state: "WAITING_RESCHEDULE_DATE",
    context: {
      appointmentId: selected.id,
      serviceId: selected.serviceId,
      serviceName: selected.serviceName,
      durationMin: selected.durationMin
    }
  });

  return sendMessage(
    appendMainMenuOption(
      `Vas a reprogramar tu cita de *${selected.serviceName}*.\n\n` +
      `¿Para qué nueva fecha?\nFormato: DD/MM/AAAA`
    )
  );
}

// ─────────────────────────────────────────────
// HANDLERS — CANCELAR (sin cambios)
// ─────────────────────────────────────────────

async function handleCancelConfirmation({ text, clinic, conversation, sendMessage }) {

  if (text === "1") {
    const appointmentId = conversation.context.appointmentId;

    const cancelled = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "cancelled" }
    });

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    if (!cancelled) {
      return sendMessage(
        "No se encontró una cita para cancelar.\n\nEscribe *inicio* para volver al menú."
      );
    }

    const { DateTime } = require("luxon");
    const dateTime = DateTime.fromJSDate(cancelled.startAt).setZone(clinic.timeZone);

    return sendMessage(
      `✅ Tu cita ha sido cancelada correctamente.\n\n` +
      `📆 Fecha: ${dateTime.toFormat("dd/MM/yyyy")}\n` +
      `⏰ Hora: ${dateTime.toFormat("hh:mm a")}\n\n` +
      `0️⃣ Volver al menú principal`
    );
  }

  if (text === "2") {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      `Operación cancelada ✅\n\n` + buildMainMenu(clinic)
    );
  }

  return sendMessage(
    "Por favor responde:\n\n1️⃣ Sí, cancelar cita\n2️⃣ No, volver al menú"
  );
}

async function handleCancelSelection({ text, clinic, conversation, sendMessage }) {

  const index = parseInt(text, 10);

  if (isNaN(index)) {
    return sendMessage(
      appendMainMenuOption(
        "Por favor responde con el número de la cita que deseas cancelar."
      )
    );
  }

  const selected = conversation.context.appointmentsList[index - 1];

  if (!selected) {
    return sendMessage(
      appendMainMenuOption("Opción inválida. Elige un número válido.")
    );
  }

  await updateConversation(conversation.id, {
    state: "WAITING_CANCEL_CONFIRMATION",
    context: { appointmentId: selected.id }
  });

  return sendMessage(
    appendMainMenuOption(
      "¿Deseas confirmar la cancelación?\n\n" +
      "1️⃣ Sí, cancelar cita\n" +
      "2️⃣ No, volver al menú"
    )
  );
}

// ─────────────────────────────────────────────
// HANDLER — VER OTRAS CITAS (sin cambios)
// ─────────────────────────────────────────────

async function handleViewOtherAppointments({ clinic, conversation, sendMessage }) {

  const remaining = conversation.context.remainingAppointments;

  if (!remaining || !remaining.length) {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(appendMainMenuOption("No hay más citas."));
  }

  const { DateTime } = require("luxon");
  let response = `📅 *Tus otras citas*\n\n`;

  remaining.forEach((appt) => {
    const dateTime = DateTime.fromJSDate(new Date(appt.startAt)).setZone(clinic.timeZone);
    response +=
      `• ${appt.serviceName} - ` +
      `${dateTime.toFormat("dd/MM/yyyy")} ` +
      `${dateTime.toFormat("hh:mm a")}\n`;
  });

  await updateConversation(conversation.id, {
    state: "IDLE",
    context: {}
  });

  return sendMessage(appendMainMenuOption(response));
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

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

function capitalizeName(name) {
  return name
    .trim()
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function handleReminderResponse({ text, clinic, conversation, sendMessage }) {

  const appointmentId = conversation.context?.appointmentId;

  if (text === "1") {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "confirmed" }
    });

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      appendMainMenuOption("✅ Tu cita ha sido confirmada. ¡Te esperamos!")
    );
  }

  if (text === "2") {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "cancelled" }
    });

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      appendMainMenuOption(
        "✅ Tu cita ha sido cancelada.\nSi deseas agendar nuevamente, escríbenos cuando quieras."
      )
    );
  }

  // ✅ Respuesta inválida
  return sendMessage(
    "Por favor responde:\n\n" +
    "1️⃣ Confirmar asistencia\n" +
    "2️⃣ Cancelar cita"
  );
}

module.exports = { handleIncomingMessage };