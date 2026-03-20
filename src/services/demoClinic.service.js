const { DateTime } = require("luxon");

// ─────────────────────────────────────────────
// CONFIGURACIÓN DE LA DEMO
// ─────────────────────────────────────────────

const DEMO_TTL_MINUTES = 15;
const demoSessions = new Map();

const DEMO_CLINIC_DATA = {
  name: "Kerbo Clínica",
  promotions:
    "🔥 Este mes: Limpieza dental + valoración GRATIS\n" +
    "⏳ Cupos limitados — ¡Agenda ya!\n\n" +
    "💎 Blanqueamiento dental con 30% de descuento",
  address:
    "📍 Av. Insurgentes Sur 123, Ciudad de México\n" +
    "🅿️ Estacionamiento disponible",
  businessHours:
    "Lunes a Viernes: 9:00 AM - 7:00 PM\n" +
    "Sábado: 9:00 AM - 2:00 PM\n" +
    "Domingo: Cerrado",
  services: [
    { name: "Consulta General", duration: "30 min" },
    { name: "Limpieza Dental", duration: "45 min" },
    { name: "Ortodoncia", duration: "60 min" },
    { name: "Blanqueamiento Dental", duration: "90 min" }
  ],
  testimonials: [
    {
      text: "Agendé mi cita en segundos desde WhatsApp. Increíble.",
      author: "María G."
    },
    {
      text: "Me recordaron mi cita automáticamente. 10 de 10.",
      author: "Carlos R."
    },
    {
      text: "La clínica nunca pierde mis datos. Muy profesional.",
      author: "Laura M."
    }
  ]
};

// ─────────────────────────────────────────────
// GESTIÓN DE SESIONES EN MEMORIA
// ─────────────────────────────────────────────

function getKey(clinicId, patientPhone) {
  return `${clinicId}_${patientPhone}`;
}

// ✅ Banner reutilizable
function buildDemoBanner() {
  return `🧪 _(Estás en la demo interactiva — ningún dato es real)_\n\n`;
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

// ─────────────────────────────────────────────
// BUILDERS
// ─────────────────────────────────────────────

function buildMainMenu() {
  return (
    `✨ *Bienvenido a la Demo Interactiva*\n\n` +
    `Soy el asistente virtual de *${DEMO_CLINIC_DATA.name}* 🦷\n\n` +
    `Esto es lo que puedo hacer por tu negocio:\n\n` +
    `1️⃣ 📅 Agendar cita\n` +
    `2️⃣ 🦷 Ver servicios\n` +
    `3️⃣ 🔥 Promociones activas\n` +
    `4️⃣ ⭐ Testimonios de pacientes\n` +
    `5️⃣ 📍 Ubicación y horarios\n` +
    `6️⃣ 💬 Hablar con asesor\n` +
    `7️⃣ 🚪 Salir de la demo\n\n` +
    `✨ Todo esto automatizado para tu negocio`
  );
}

function buildClosingMessage() {
  return (
    `🚀 *¿Te gustó la experiencia?*\n\n` +
    `Esto es exactamente lo que verían tus pacientes.\n\n` +
    `✅ Configurado para tu negocio\n` +
    `✅ Listo en menos de 24 horas\n` +
    `✅ Sin conocimientos técnicos\n\n` +
    `¿Hablamos?\n\n` +
    `1️⃣ Agendar demo personalizada\n` +
    `2️⃣ Volver al inicio de la demo`
  );
}

function appendMenuOption(text) {
  return `${text}\n\n0️⃣ Volver al menú`;
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────

async function handleDemoMessage({
  clinic,
  message,
  patientPhone,
  sendMessage
}) {
  const text = message.toLowerCase().trim();
  const session = createOrRefreshSession(clinic.id, patientPhone);

  // ✅ Inicio forzado desde Sales Bot
  if (message === "__start__") {
    session.step = "MENU";
    return sendMessage(buildMainMenu());
  }

  // ✅ Escape global al menú
  if (text === "0" && session.step !== "CLOSING") {
    session.step = "MENU";
    return sendMessage(buildMainMenu());
  }

  switch (session.step) {

    // ─────────────────────────────────────────
    case "MENU":
    // ─────────────────────────────────────────

      if (text === "1") {
        session.step = "ASK_DATE";
        return sendMessage(
          appendMenuOption(
            buildDemoBanner() +
            `📅 *Agendar cita en ${DEMO_CLINIC_DATA.name}*\n\n` +
            `¿Para qué fecha deseas la cita?\n` +
            `Formato: DD/MM/AAAA`
          )
        );
      }

      if (text === "2") {
        let response = `🦷 *Nuestros servicios*\n\n`;

        DEMO_CLINIC_DATA.services.forEach((service) => {
          response += `• ${service.name} (${service.duration})\n`;
        });

        response += `\n¿Te gustaría agendar alguno?`;

        return sendMessage(appendMenuOption(response));
      }

      if (text === "3") {
        return sendMessage(
          appendMenuOption(
            buildDemoBanner() +
            `🔥 *Promociones activas*\n\n` +
            DEMO_CLINIC_DATA.promotions
          )
        );
      }

      if (text === "4") {
        let response = `⭐ *Testimonios de nuestros pacientes*\n\n`;

        DEMO_CLINIC_DATA.testimonials.forEach((t) => {
          response += `💬 _"${t.text}"_\n`;
          response += `— ${t.author}\n\n`;
        });

        response += `¿Listo para tu cita?`;

        return sendMessage(appendMenuOption(response));
      }

      if (text === "5") {
        return sendMessage(
          appendMenuOption(
            `📍 *Ubicación y horarios*\n\n` +
            `${DEMO_CLINIC_DATA.address}\n\n` +
            `🕐 *Horarios de atención*\n` +
            DEMO_CLINIC_DATA.businessHours
          )
        );
      }

      if (text === "6") {
        session.step = "CLOSING";
        return sendMessage(
          `💬 *Hablar con un asesor*\n\n` +
          `En tu versión real, aquí tus pacientes podrían\n` +
          `escribirte directamente y recibirías una\n` +
          `notificación al instante en tu celular 📱\n\n` +
          buildClosingMessage()
        );
      }

      if (text === "7") {
        destroySession(clinic.id, patientPhone);
        session.step = "CLOSING";
        return sendMessage(buildClosingMessage());
      }

      return sendMessage(buildMainMenu());

    // ─────────────────────────────────────────
    case "ASK_DATE":
    // ─────────────────────────────────────────

      const dateObj = DateTime.fromFormat(text, "dd/MM/yyyy", {
        zone: "America/Mexico_City"
      });

      if (!dateObj.isValid) {
        return sendMessage(
          appendMenuOption(
            "Fecha inválida.\nUsa formato DD/MM/AAAA\n\n" +
            "Ejemplo: 25/03/2026"
          )
        );
      }

      const today = DateTime.now()
        .setZone("America/Mexico_City")
        .startOf("day");

      if (dateObj < today) {
        return sendMessage(
          appendMenuOption(
            "No puedes agendar una fecha pasada.\n" +
            "Por favor elige otra fecha."
          )
        );
      }

      session.tempDateISO = dateObj.toFormat("yyyy-MM-dd");
      session.step = "ASK_SERVICE";

      let serviceMenu = buildDemoBanner() +
        `🦷 *¿Qué servicio deseas agendar?*\n\n`;

      DEMO_CLINIC_DATA.services.forEach((service, index) => {
        serviceMenu += `${index + 1}️⃣ ${service.name} (${service.duration})\n`;
      });

      return sendMessage(appendMenuOption(serviceMenu));

    // ─────────────────────────────────────────
    case "ASK_SERVICE":
    // ─────────────────────────────────────────

      const serviceIndex = parseInt(text, 10);

      if (
        isNaN(serviceIndex) ||
        serviceIndex < 1 ||
        serviceIndex > DEMO_CLINIC_DATA.services.length
      ) {
        let serviceMenu = `Por favor elige un número válido:\n\n`;

        DEMO_CLINIC_DATA.services.forEach((service, index) => {
          serviceMenu += `${index + 1}️⃣ ${service.name}\n`;
        });

        return sendMessage(appendMenuOption(serviceMenu));
      }

      session.selectedService = DEMO_CLINIC_DATA.services[serviceIndex - 1];
      session.step = "ASK_NAME";

      return sendMessage(
        appendMenuOption(
          buildDemoBanner() +
          `Perfecto ✅\n\n` +
          `Has elegido: *${session.selectedService.name}*\n\n` +
          `¿A nombre de quién agendamos la cita?`
        )
      );

    // ─────────────────────────────────────────
    case "ASK_NAME":
    // ─────────────────────────────────────────

      const name = text.trim();

      if (!name || name.length < 2) {
        return sendMessage(
          appendMenuOption("Por favor ingresa un nombre válido.")
        );
      }

      if (name.length > 100) {
        return sendMessage(
          appendMenuOption("El nombre es demasiado largo. Intenta nuevamente.")
        );
      }

      session.patientName = name
        .trim()
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      session.step = "ASK_TIME";

      return sendMessage(
        appendMenuOption(
          buildDemoBanner() +
          `Gracias 😊\n\n` +
          `¿A qué hora deseas la cita?\n\n` +
          `Puedes escribir por ejemplo:\n` +
          `• 14:30\n` +
          `• 3pm\n` +
          `• 3:30pm`
        )
      );

    // ─────────────────────────────────────────
    case "ASK_TIME":
    // ─────────────────────────────────────────

      const parsedTime = parseTime(text);

      if (!parsedTime) {
        return sendMessage(
          appendMenuOption(
            "Hora inválida.\n\nPuedes escribir:\n" +
            "• 14:30\n" +
            "• 3pm\n" +
            "• 3:30pm"
          )
        );
      }

      const startAtISO = `${session.tempDateISO}T${parsedTime}:00`;

      const confirmedDate = DateTime.fromISO(startAtISO, {
        zone: "America/Mexico_City"
      });

      // ✅ Guardar cita en sesión
      session.appointment = {
        startAtISO,
        serviceName: session.selectedService.name,
        patientName: session.patientName
      };

      session.step = "CLOSING";

      return sendMessage(
        buildDemoBanner() + 
        `✅ *Cita confirmada*\n\n` +
        `👤 Paciente: ${session.patientName}\n` +
        `🦷 Servicio: ${session.selectedService.name}\n` +
        `📅 Fecha: ${confirmedDate.toFormat("dd/MM/yyyy")}\n` +
        `⏰ Hora: ${confirmedDate.toFormat("hh:mm a")}\n\n` +
        `Así de fácil agenda un paciente real 🙌\n\n` +
        buildClosingMessage()
      );

    // ─────────────────────────────────────────
    case "CLOSING":
    // ─────────────────────────────────────────

    if (text === "1") {
      destroySession(clinic.id, patientPhone);

      // ✅ Ir directo a BOOKING_DATE del flujo de ventas
      const {
        getOrCreateConversation,
        updateConversation
      } = require("./conversation.service");

      const conversation = await getOrCreateConversation({
        clinicId: clinic.id,
        patientPhone,
        patientName: null
      });

      await updateConversation(conversation.id, {
        state: "SALES_BOOKING_DATE",
        context: {}
      });

      return sendMessage(
        `¡Excelente decisión! 🚀\n\n` +
        `Vamos a agendar tu demo personalizada.\n\n` +
        `📅 ¿Para qué fecha la agendamos?\n` +
        `Formato: DD/MM/AAAA\n\n` +
        `0️⃣ Volver al inicio`
      );
    }

      // ✅ Volver al inicio de la demo
      if (text === "2") {
        session.step = "MENU";
        session.appointment = null;
        session.tempDateISO = null;
        session.selectedService = null;
        session.patientName = null;
        return sendMessage(buildMainMenu());
      }

      return sendMessage(buildClosingMessage());

    // ─────────────────────────────────────────
    default:
    // ─────────────────────────────────────────
      session.step = "MENU";
      return sendMessage(buildMainMenu());
  }
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

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
// EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  handleDemoMessage,
  isUserInDemo
};