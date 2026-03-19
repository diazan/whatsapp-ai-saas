const { getAvailableSlotsForDay } = require("./availability.service");
const prisma = require("../lib/prisma");
const { createAppointment, rescheduleAppointment, cancelNextUpcomingAppointment  } = require("./bookingService");
const { parseDate } = require("../utils/date.utils");
const {
  getOrCreateConversation,
  updateConversation
} = require("./conversation.service");

const BOOKING_KEYWORDS = ["cita", "turno", "agendar", "reservar"];

const { handleSalesBot } = require("./salesBot.service");

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

  if (conversation.expired) {

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      active: false,
      state: "CANCELLED"
    }
  });

  return sendMessage(
    "La conversación anterior expiró por inactividad.\n\nEscribe *inicio* para comenzar nuevamente."
  );
}

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
  // ✅ Escape global al menú principal
  if (text === "0") {

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      `¿Qué deseas hacer?\n\n` +
      `1️⃣ Agendar cita\n` +
      `2️⃣ Cancelar cita\n` +
      `3️⃣ Ver mi próxima cita\n` +
      `4️⃣ Reprogramar cita`
    );
  }

  if (text === "hola" || text === "inicio") {

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      "¡Hola! Bienvenido(a) a *Kerbo Odontología*👋\n\n" +
      "¿Qué deseas hacer?\n\n" +
      "1️⃣ Agendar cita\n" +
      "2️⃣ Cancelar cita\n" +
      "3️⃣ Ver mi próxima cita\n" +
      "4️⃣ Reprogramar cita"
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

    case "WAITING_NAME": // 👈 NUEVO
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
    console.log("STATE ACTUAL:", conversation.state);

    case "WAITING_VIEW_OTHER_APPOINTMENTS":
      return handleViewOtherAppointments({ clinic, conversation, sendMessage });
    
    default:
      return sendMessage(
        "Escribe *inicio* para comenzar a agendar."
      );
  }

};

async function handleIdle({ text, clinic, conversation, sendMessage }) {

  if (text !== "1" && text !== "2" && text !== "3" && text !== "4") {
    return sendMessage(
      "¡Hola! Bienvenido(a) a *Kerbo Odontología*👋\n\n" +
      "¿Qué deseas hacer?\n\n" +
      "1️⃣ Agendar cita\n" +
      "2️⃣ Cancelar cita\n" +
      "3️⃣ Ver mi próxima cita\n" +
      "4️⃣ Reprogramar cita"
    );
  }

  // ✅ Opción 1 - Agendar
  if (text === "1") {
    const services = await prisma.service.findMany({
      where: {
        clinicId: clinic.id,
        active: true
      },
      orderBy: {
        displayOrder: "asc"
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

    return sendMessage(
      appendMainMenuOption(response)
    );
  }

  // ✅ Opción 2 - Cancelar
  if (text === "2") {

    const now = new Date();

    const appointments = await prisma.appointment.findMany({
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
      include: {
        service: true
      },
      orderBy: {
        startAt: "asc"
      }
    });

    if (!appointments.length) {
      return sendMessage(
        "No tienes citas próximas para cancelar."
      );
    }

    // ✅ Si solo hay una, mantener comportamiento actual
    if (appointments.length === 1) {

      const appointment = appointments[0];

      await updateConversation(conversation.id, {
        state: "WAITING_CANCEL_CONFIRMATION",
        context: {
          appointmentId: appointment.id
        }
      });

      const { DateTime } = require("luxon");

      const dateTime = DateTime.fromJSDate(appointment.startAt)
        .setZone(clinic.timeZone);

      return sendMessage(
        "Estás a punto de cancelar tu cita:\n\n" +
        `📆 Fecha: ${dateTime.toFormat("dd/MM/yyyy")}\n` +
        `⏰ Hora: ${dateTime.toFormat("hh:mm a")}\n\n` +
        "¿Deseas confirmar?\n\n" +
        "1️⃣ Sí, cancelar cita\n" +
        "2️⃣ No, volver al menú"
      );
    }

    // ✅ Si hay varias, mostrar menú numerado
    const { DateTime } = require("luxon");

    let response = "Tienes las siguientes citas:\n\n";

    appointments.forEach((appt, index) => {
      const dateTime = DateTime.fromJSDate(appt.startAt)
        .setZone(clinic.timeZone);

      response +=
        `${index + 1}️⃣ ${appt.service.name} - ` +
        `${dateTime.toFormat("dd/MM/yyyy")} ` +
        `${dateTime.toFormat("hh:mm a")}\n`;
    });

    response += "\nResponde con el número de la cita que deseas cancelar.";

    await updateConversation(conversation.id, {
      state: "WAITING_CANCEL_SELECTION",
      context: {
        appointmentsList: appointments.map(a => ({
          id: a.id
        }))
      }
    });

    return sendMessage(
      appendMainMenuOption(response)
    );
  }

    // ✅ Opción 3 - Ver próxima cita
  if (text === "3") {

    const now = new Date();

    const appointments = await prisma.appointment.findMany({
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
      include: {
        service: true
      },
      orderBy: {
        startAt: "asc"
      }
    });

    if (!appointments.length) {
      return sendMessage(
        appendMainMenuOption(
          "No tienes citas próximas."
        )
      );
    }

    const { DateTime } = require("luxon");

    const nextAppointment = appointments[0];

    const dateTime = DateTime.fromJSDate(nextAppointment.startAt)
      .setZone(clinic.timeZone);

    const formattedDate = dateTime.toFormat("dd/MM/yyyy");
    const formattedTime = dateTime.toFormat("hh:mm a");

    let response =
      "📅 Tu próxima cita:\n\n" +
      `👤 Paciente: ${nextAppointment.patientName}\n` +
      `🦷 Servicio: ${nextAppointment.service.name}\n` +
      `📆 Fecha: ${formattedDate}\n` +
      `⏰ Hora: ${formattedTime}`;

    // ✅ Si tiene más de una cita
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

      response +=
        "\n\n1️⃣ Ver otras citas";

      return sendMessage(
        appendMainMenuOption(response)
      );
    }

    return sendMessage(
      appendMainMenuOption(response)
    );
  }

  // ✅ Opción 4 - Reprogramar
  if (text === "4") {

    const now = new Date();

    const appointments = await prisma.appointment.findMany({
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
      include: {
        service: true
      },
      orderBy: {
        startAt: "asc"
      }
    });

    if (!appointments.length) {
      return sendMessage(
        "No tienes citas próximas para reprogramar."
      );
    }

    // ✅ Si solo tiene una, mantener comportamiento actual
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
          `Vas a reprogramar tu cita de ${appointment.service.name}.\n\n` +
          `¿Para qué nueva fecha?\nFormato: DD/MM/AAAA`
        )
      );
    }

    // ✅ Si tiene varias, mostrar menú numerado
    let response = "Tienes las siguientes citas:\n\n";

    const { DateTime } = require("luxon");

    appointments.forEach((appt, index) => {
      const dateTime = DateTime.fromJSDate(appt.startAt)
        .setZone(clinic.timeZone);

      response +=
        `${index + 1}️⃣ ${appt.service.name} - ` +
        `${dateTime.toFormat("dd/MM/yyyy")} ` +
        `${dateTime.toFormat("hh:mm a")}\n`;
    });

    response += "\nResponde con el número de la cita que deseas reprogramar.";

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

    return sendMessage(
      appendMainMenuOption(response)
    );
  }
}

async function handleServiceSelection({ text, clinic, conversation, sendMessage }) {

  const index = Number(text);
  
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
      appendMainMenuOption(
        "Opción inválida. Intenta nuevamente."
      )
    );
  }

  await updateConversation(conversation.id, {
    state: "WAITING_NAME", // ✅ Estado correcto
    context: {
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      durationMin: selectedService.durationMin
      // ✅ Sin patientName aquí — se captura en el siguiente paso
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

  // ✅ Validación básica
  if (!name || name.length < 2) {
    return sendMessage(
      appendMainMenuOption(
        "Por favor ingresa un nombre válido."
      )
    );
  }

  if (name.length > 100) {
    return sendMessage(
      appendMainMenuOption(
        "El nombre es demasiado largo. Intenta nuevamente."
      )
    );
  }

  // ✅ Guardamos nombre en contexto y avanzamos a fecha
  await updateConversation(conversation.id, {
    state: "WAITING_DATE",
    context: {
      ...conversation.context,
      patientName: capitalizeName(name) // ✅ Aquí sí existe `name`
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
    return sendMessage(
      "Fecha inválida.\nUsa formato DD/MM/AAAA"
    );
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

  const updatedContext = {
    ...conversation.context,
    dateISO: date.toISOString().split("T")[0]
  };

  await updateConversation(conversation.id, {
    state: "WAITING_TIME",
    context: updatedContext
  });

  return sendMessage(
    appendMainMenuOption(
      "Perfecto ✅\n\n¿A qué hora deseas la cita?\nFormato: HH:mm"
    )
  );
}

async function handleTimeSelection({ text, clinic, conversation, sendMessage }) {


  // ✅ Si respondió solo con número (ej: "1", "2")
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
      appendMainMenuOption(
        "Hora inválida.\nUsa formato HH:mm"
      )
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
      patientName: conversation.context.patientName  // 👈 Del contexto (ingresado por usuario)
                || conversation.patientName           // 👈 Fallback: perfil WhatsApp
                || "Paciente",                        // 👈 Último recurso
      patientPhone: conversation.patientPhone,
      startAt: startAtISO,
    });

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    const serviceName = conversation.context.serviceName;
    const dateISO = conversation.context.dateISO;

    // Formatear fecha DD/MM/AAAA
    const [year, month, day] = dateISO.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    // Formatear hora a AM/PM
    const [hourStr, minute] = time.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";

    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;

    const formattedTime = `${hour}:${minute} ${ampm}`;

    const rawName = conversation.context.patientName
                 || conversation.patientName
                 || "Paciente";

    const confirmedName = capitalizeName(rawName);


    return sendMessage(
      `✅ *Cita confirmada*\n\n` +
      `👤 Paciente: ${confirmedName}\n` +
      `🦷 Servicio: ${serviceName}\n` +
      `📅 Fecha: ${formattedDate}\n` +
      `⏰ Hora: ${formattedTime}\n\n` +
      "¿Qué deseas hacer ahora?\n\n" +
      "1️⃣ Agendar cita\n" +
      "2️⃣ Cancelar cita\n" +
      "3️⃣ Ver mi próxima cita\n" +
      "4️⃣ Reprogramar cita"
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
            appendMainMenuOption(
              "Ese horario no está disponible.\n\n" +
              "Estos horarios están libres:\n" +
              suggestions.join("\n") +
              "\n\nEscribe uno en formato HH:mm"
            )
          );
        }

        return sendMessage(
          appendMainMenuOption(
            "Ese horario no está disponible.\nElige otra hora."
          )
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
          appendMainMenuOption(
            error.message + "\nElige otra hora."
          )
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

async function handleRescheduleDate({ text, clinic, conversation, sendMessage }) {

  const date = parseDate(text);

  if (!date) {
    return sendMessage(
      appendMainMenuOption(
        "Fecha inválida.\nUsa formato DD/MM/AAAA"
      )
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return sendMessage(
      appendMainMenuOption(
        "No puedes elegir una fecha pasada."
      )
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

  let response = "Estos horarios están disponibles:\n\n";

  limitedSlots.forEach((slot, index) => {
    response += `${index + 1}️⃣ ${slot}\n`;
  });

  response += "\nResponde con el número o escribe la hora (ej: 2pm).";

  await updateConversation(conversation.id, {
    state: "WAITING_RESCHEDULE_TIME",
    context: {
      ...updatedContext,
      availableSlots: limitedSlots
    }
  });

  return sendMessage(
    appendMainMenuOption(response)
  );
}

async function handleRescheduleTime({ text, clinic, conversation, sendMessage }) {

  // ✅ Si respondió con número (ej: "1", "2")
  if (/^\d+$/.test(text) && conversation.context.availableSlots) {

    const index = parseInt(text, 10);
    const selected = conversation.context.availableSlots[index - 1];

    if (!selected) {
      return sendMessage(
        appendMainMenuOption(
          "Opción inválida. Elige un número válido."
        )
      );
    }

    text = selected;
  }

  const time = parseTime(text);

  if (!time) {
    return sendMessage(
      appendMainMenuOption(
        "Hora inválida.\nUsa formato HH:mm"
      )
    );
  }

  const dateISO = conversation.context.dateISO;
  const startAtISO = `${dateISO}T${time}:00`;

  // ✅ Ahora NO reprogramamos aún — pedimos confirmación

  await updateConversation(conversation.id, {
    state: "WAITING_RESCHEDULE_CONFIRMATION",
    context: {
      ...conversation.context,
      newStartAtISO: startAtISO
    }
  });

  const { DateTime } = require("luxon");

  const dateTime = DateTime.fromISO(startAtISO, {
    zone: clinic.timeZone
  });

  const formattedDate = dateTime.toFormat("dd/MM/yyyy");
  const formattedTime = dateTime.toFormat("hh:mm a");

  return sendMessage(
    appendMainMenuOption(
      `Vas a reprogramar tu cita:\n\n` +
      `📅 Nueva fecha: ${formattedDate}\n` +
      `⏰ Nueva hora: ${formattedTime}\n\n` +
      `¿Deseas confirmar?\n\n` +
      `1️⃣ Confirmar reprogramación\n` +
      `2️⃣ Cancelar operación`
    )
  );
}

async function handleCancelConfirmation({ text, clinic, conversation, sendMessage }) {

  // ✅ Confirmar cancelación
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

    const dateTime = DateTime.fromJSDate(cancelled.startAt)
      .setZone(clinic.timeZone);

    const formattedDate = dateTime.toFormat("dd/MM/yyyy");
    const formattedTime = dateTime.toFormat("hh:mm a");

    return sendMessage(
      "✅ Tu cita ha sido cancelada correctamente.\n\n" +
      `📆 Fecha: ${formattedDate}\n` +
      `⏰ Hora: ${formattedTime}\n\n` +
      "¿Qué deseas hacer ahora?\n\n" +
      "1️⃣ Agendar cita\n" +
      "2️⃣ Cancelar cita\n" +
      "3️⃣ Ver mi próxima cita\n" +
      "4️⃣ Reprogramar cita"
    );
  }

  // ✅ Cancelar operación (no cancelar cita)
  if (text === "2") {

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      `Operación cancelada ✅\n\n¿Qué deseas hacer?\n\n` +
      `1️⃣ Agendar cita\n` +
      `2️⃣ Cancelar cita\n` +
      `3️⃣ Ver mi próxima cita\n` +
      `4️⃣ Reprogramar cita`
    );
  }

  return sendMessage(
    "Por favor responde:\n\n1️⃣ Sí, cancelar cita\n2️⃣ No, volver al menú"
  );
}

function appendMainMenuOption(text) {
  return `${text}\n\n0️⃣ Volver al menú principal`;
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

      const dateTime = DateTime.fromISO(newStartAtISO, {
        zone: clinic.timeZone
      });

      const formattedDate = dateTime.toFormat("dd/MM/yyyy");
      const formattedTime = dateTime.toFormat("hh:mm a");

      return sendMessage(
        `✅ Tu cita ha sido reprogramada\n\n` +
        `📅 Fecha: ${formattedDate}\n` +
        `⏰ Hora: ${formattedTime}\n\n` +
        "¿Qué deseas hacer ahora?\n\n" +
        "1️⃣ Agendar cita\n" +
        "2️⃣ Cancelar cita\n" +
        "3️⃣ Ver mi próxima cita\n" +
        "4️⃣ Reprogramar cita"
      );

    } catch (error) {

      if (error.message === "Time slot not available") {
        return sendMessage(
          appendMainMenuOption(
            "Ese horario ya no está disponible.\nElige otro."
          )
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
      `Operación cancelada ✅\n\n` +
      `1️⃣ Agendar cita\n` +
      `2️⃣ Cancelar cita\n` +
      `3️⃣ Ver mi próxima cita\n` +
      `4️⃣ Reprogramar cita`
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
      appendMainMenuOption(
        "Opción inválida. Elige un número válido."
      )
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
      `Vas a reprogramar tu cita de ${selected.serviceName}.\n\n` +
      `¿Para qué nueva fecha?\nFormato: DD/MM/AAAA`
    )
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
      appendMainMenuOption(
        "Opción inválida. Elige un número válido."
      )
    );
  }

  await updateConversation(conversation.id, {
    state: "WAITING_CANCEL_CONFIRMATION",
    context: {
      appointmentId: selected.id
    }
  });

  return sendMessage(
    appendMainMenuOption(
      "¿Deseas confirmar la cancelación?\n\n" +
      "1️⃣ Sí, cancelar cita\n" +
      "2️⃣ No, volver al menú"
    )
  );
}

async function handleViewOtherAppointments({ clinic, conversation, sendMessage }) {

  const remaining = conversation.context.remainingAppointments;

  if (!remaining || !remaining.length) {

    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      appendMainMenuOption("No hay más citas.")
    );
  }

  const { DateTime } = require("luxon");

  let response = "📅 Tus otras citas:\n\n";

  remaining.forEach((appt, index) => {

    const dateTime = DateTime.fromJSDate(new Date(appt.startAt))
      .setZone(clinic.timeZone);

    response +=
      `• ${appt.serviceName} - ` +
      `${dateTime.toFormat("dd/MM/yyyy")} ` +
      `${dateTime.toFormat("hh:mm a")}\n`;
  });

  // ✅ Después de mostrar, volvemos a IDLE
  await updateConversation(conversation.id, {
    state: "IDLE",
    context: {}
  });

  return sendMessage(
    appendMainMenuOption(response)
  );
}

async function handleOtherAppointmentAction({ text, clinic, conversation, sendMessage }) {

  const { appointmentId } = conversation.context;

  if (!appointmentId) {
    await updateConversation(conversation.id, {
      state: "IDLE",
      context: {}
    });

    return sendMessage(
      appendMainMenuOption("Ocurrió un error. Escribe inicio para continuar.")
    );
  }

  // ✅ Cancelar esta cita
  if (text === "1") {

    await updateConversation(conversation.id, {
      state: "WAITING_CANCEL_CONFIRMATION",
      context: {
        appointmentId
      }
    });

    return sendMessage(
      "¿Deseas confirmar la cancelación?\n\n" +
      "1️⃣ Sí, cancelar cita\n" +
      "2️⃣ No, volver al menú"
    );
  }

  // ✅ Reprogramar esta cita
  if (text === "2") {

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true }
    });

    await updateConversation(conversation.id, {
      state: "WAITING_RESCHEDULE_DATE",
      context: {
        appointmentId,
        serviceId: appointment.serviceId,
        serviceName: appointment.service.name,
        durationMin: appointment.service.durationMin
      }
    });

    return sendMessage(
      appendMainMenuOption(
        `Vas a reprogramar tu cita de ${appointment.service.name}.\n\n` +
        `¿Para qué nueva fecha?\nFormato: DD/MM/AAAA`
      )
    );
  }

  return sendMessage(
    "Responde:\n\n" +
    "1️⃣ Cancelar esta cita\n" +
    "2️⃣ Reprogramar esta cita\n" +
    "0️⃣ Volver al menú principal"
  );
}

function capitalizeName(name) {
  return name
    .trim()
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

module.exports = {
  handleIncomingMessage
};