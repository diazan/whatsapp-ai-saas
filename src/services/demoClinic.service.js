const { DateTime } = require("luxon");

const DEMO_TTL_MINUTES = 15;
const demoSessions = new Map();

function getKey(clinicId, patientPhone) {
  return `${clinicId}_${patientPhone}`;
}

function createOrRefreshSession(clinicId, patientPhone) {
  const key = getKey(clinicId, patientPhone);
  const expiresAt = Date.now() + DEMO_TTL_MINUTES * 60 * 1000;

  let session = demoSessions.get(key);

  if (!session) {
    session = {
      step: "MENU",
      appointment: null,
      tempDateISO: null,
      expiresAt
    };
    demoSessions.set(key, session);
  } else {
    session.expiresAt = expiresAt;
  }

  return session;
}

function destroySession(clinicId, patientPhone) {
  const key = getKey(clinicId, patientPhone);
  demoSessions.delete(key);
}

function isUserInDemo(clinicId, patientPhone) {
  const key = getKey(clinicId, patientPhone);
  const session = demoSessions.get(key);

  if (!session) return false;

  if (session.expiresAt < Date.now()) {
    demoSessions.delete(key);
    return false;
  }

  return true;
}

function getMenuMessage() {
  return (
    "🧪 *DEMO INTERACTIVA KERBO*\n\n" +
    "1️⃣ Agendar cita\n" +
    "2️⃣ Ver mi cita\n" +
    "3️⃣ Reprogramar cita\n" +
    "4️⃣ Cancelar cita\n" +
    "5️⃣ Salir demo"
  );
}

async function handleDemoMessage({
  clinic,
  message,
  patientPhone,
  sendMessage
}) {
  const text = message.toLowerCase().trim();
  const session = createOrRefreshSession(clinic.id, patientPhone);

  // 🔹 Inicio forzado desde Sales Bot
  if (message === "__start__") {
    session.step = "MENU";
    return sendMessage(getMenuMessage());
  }

  switch (session.step) {

    case "MENU":

      if (text === "1") {
        session.step = "ASK_DATE";
        return sendMessage(
          "📅 Ingresa una fecha para tu cita demo.\n" +
          "Formato: DD/MM/AAAA\n\n" +
          "0️⃣ Volver al menú"
        );
      }

      if (text === "2") {
        if (!session.appointment) {
          return sendMessage(
            "No tienes ninguna cita agendada en esta demo.\n\n0️⃣ Volver al menú"
          );
        }

        const date = DateTime.fromISO(session.appointment.startAtISO, {
          zone: clinic.timeZone
        });

        return sendMessage(
          "📋 *Tu cita demo*\n\n" +
          `📅 ${date.toFormat("dd/MM/yyyy")}\n` +
          `⏰ ${date.toFormat("hh:mm a")}\n\n` +
          "0️⃣ Volver al menú"
        );
      }

      if (text === "3") {
        if (!session.appointment) {
          return sendMessage(
            "Primero debes agendar una cita.\n\n0️⃣ Volver al menú"
          );
        }

        session.step = "ASK_DATE";
        return sendMessage(
          "📅 Ingresa la nueva fecha.\nFormato: DD/MM/AAAA\n\n0️⃣ Volver al menú"
        );
      }

      if (text === "4") {
        if (!session.appointment) {
          return sendMessage(
            "No tienes ninguna cita para cancelar.\n\n0️⃣ Volver al menú"
          );
        }

        session.appointment = null;

        return sendMessage(
          "✅ Tu cita demo ha sido cancelada.\n\n0️⃣ Volver al menú"
        );
      }

      if (text === "5") {
        destroySession(clinic.id, patientPhone);

        return sendMessage(
          "Has salido de la demo interactiva.\n\n" +
          "Escribe 1 si deseas agendar una demo personalizada con nuestro equipo."
        );
      }

      return sendMessage("Elige una opción válida.");

    case "ASK_DATE":

      if (text === "0") {
        session.step = "MENU";
        return sendMessage(getMenuMessage());
      }

      // ✅ Validación robusta con Luxon
      const dateObj = DateTime.fromFormat(text, "dd/MM/yyyy", {
        zone: clinic.timeZone
      });

      if (!dateObj.isValid) {
        return sendMessage("Fecha inválida. Usa formato DD/MM/AAAA");
      }

      const today = DateTime.now()
        .setZone(clinic.timeZone)
        .startOf("day");

      if (dateObj < today) {
        return sendMessage("No puedes agendar una fecha pasada.");
      }

      session.tempDateISO = dateObj.toFormat("yyyy-MM-dd");
      session.step = "ASK_TIME";

      return sendMessage(
        "⏰ Ingresa la hora en formato HH:mm\n" +
        "Ejemplo: 14:30\n\n0️⃣ Volver al menú"
      );

    case "ASK_TIME":

      if (text === "0") {
        session.step = "MENU";
        return sendMessage(getMenuMessage());
      }

      const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

      if (!timeRegex.test(text)) {
        return sendMessage("Hora inválida. Usa formato HH:mm");
      }

      const startAtISO = `${session.tempDateISO}T${text}:00`;

      session.appointment = { startAtISO };
      session.step = "MENU";

      const confirmedDate = DateTime.fromISO(startAtISO, {
        zone: clinic.timeZone
      });

        return sendMessage(
        "✅ *Cita demo confirmada*\n\n" +
        `📅 ${confirmedDate.toFormat("dd/MM/yyyy")}\n` +
        `⏰ ${confirmedDate.toFormat("hh:mm a")}\n\n` +
        "Así funciona el sistema real con tus pacientes.\n\n" +
        getMenuMessage()
        );

    default:
      session.step = "MENU";
      return sendMessage(getMenuMessage());
  }
}

module.exports = {
  handleDemoMessage,
  isUserInDemo
};