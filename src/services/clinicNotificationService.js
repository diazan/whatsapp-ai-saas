const { sendWhatsAppMessage } = require("./whatsappService");

const CLINIC_FLOW_KEYWORDS = [
  "0", "1", "2", "3", "4", "5", "6",
  "hola", "inicio",
  "cita", "turno", "agendar", "reservar",
  "Hola, me interesa conocer más sobre el servicio"
];

// ✅ Estados del flujo donde el usuario ingresa datos
const BOOKING_FLOW_STATES = [
  "WAITING_SUBMENU_CITAS",
  "WAITING_SERVICE",
  "WAITING_NAME",
  "WAITING_DATE",
  "WAITING_TIME",
  "WAITING_RESCHEDULE_DATE",
  "WAITING_RESCHEDULE_TIME",
  "WAITING_RESCHEDULE_CONFIRMATION",
  "WAITING_CANCEL_CONFIRMATION",
  "WAITING_RESCHEDULE_SELECTION",
  "WAITING_CANCEL_SELECTION",
  "WAITING_VIEW_OTHER_APPOINTMENTS",
  "WAITING_ADVISOR_QUESTION",
  "WAITING_INFO_REQUEST_MESSAGE",
  "WAITING_INFO_REQUEST_NAME",
  "WAITING_INFO_REQUEST_CONTACT"
];

  const COOLDOWN_MS = 1 * 60 * 1000; // 5 minutos
//const COOLDOWN_MS = 15 * 1000;

// Map en memoria: clave = "clinicId:phone"
// valor = { messages: [], timer }
const notificationQueue = new Map();

function isValidFlowResponse(state, text) {
  console.log("🔍 isValidFlowResponse:", { state, text });

  const isNumber = /^[1-9]$/.test(text); 
  const isDate = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text);
  const isTime = /^\d{1,2}:\d{2}$/.test(text) ||
                /^\d{1,2}(am|pm)$/.test(text) ||
                /^\d{1,2}:\d{2}(am|pm)$/.test(text) ||
                /^\d{1,2}:\d{2}\s+(am|pm)$/i.test(text);
  const isName = /^[a-záéíóúüñ\s]+$/i.test(text);

  // ✅ Validación cruzada por formato — independiente del estado
  // Si el texto parece dato del flujo, ignorarlo siempre
  if (isDate) return true;
  if (isTime) return true;

  switch (state) {

    case "WAITING_SERVICE":
    case "WAITING_RESCHEDULE_SELECTION":
    case "WAITING_CANCEL_SELECTION":
      return isNumber;

    case "WAITING_NAME":
      return isName;

    case "WAITING_DATE":
    case "WAITING_RESCHEDULE_DATE":
      return isDate;

    case "WAITING_TIME":
    case "WAITING_RESCHEDULE_TIME":
      return isTime || isNumber;

    case "WAITING_CANCEL_CONFIRMATION":
    case "WAITING_RESCHEDULE_CONFIRMATION":
      return text === "1" || text === "2";

    case "WAITING_VIEW_OTHER_APPOINTMENTS":
      return text === "1";

    case "WAITING_SUBMENU_CITAS":     // ← ya agregado
      return isNumber;

    case "WAITING_ADVISOR_QUESTION":  // ← agregar esto
      return true;  

    case "WAITING_INFO_REQUEST_MESSAGE":
    case "WAITING_INFO_REQUEST_NAME":
    case "WAITING_INFO_REQUEST_CONTACT":
      return true;

    default:
      return false;
  }
}

const evaluateClinicNotification = async ({
  phone,
  clinic,
  incomingMessage,
  conversationState = "IDLE" // 👈 Nuevo parámetro
}) => {

  try {
    // Verificar que la clínica tiene adminPhone configurado
    if (!clinic.adminPhone) {
      console.log("[clinicNotification] adminPhone no configurado para clínica:", clinic.id);
      return;
    }

    // Verificar que las notificaciones están activas
    if (!clinic.notificationsActive) {
      console.log("[clinicNotification] Notificaciones desactivadas para clínica:", clinic.id);
      return;
    }

    // ✅ Ignorar palabras del flujo del bot
    if (CLINIC_FLOW_KEYWORDS.includes(incomingMessage.toLowerCase().trim())) {
      console.log("[clinicNotification] Mensaje del flujo ignorado:", incomingMessage);
      return;
    }

    // ✅ Ignorar solo respuestas válidas dentro del flujo
    if (isValidFlowResponse(conversationState, incomingMessage.toLowerCase().trim())) {
      console.log("[clinicNotification] Respuesta válida de flujo ignorada:", incomingMessage);
      return;
    }

    const key = `${clinic.id}:${phone}`;

    // Si ya hay una cola activa para este paciente, acumular mensaje
    if (notificationQueue.has(key)) {
      notificationQueue.get(key).messages.push(incomingMessage);
      console.log(`[clinicNotification] Mensaje acumulado en cola — key: ${key}`);
      return;
    }

    // Crear nueva entrada en la cola
    const entry = {
      messages: [incomingMessage],
      timer: null
    };

    // Timer que envía el resumen después de 5 minutos
    entry.timer = setTimeout(async () => {
      try {
        const queued = notificationQueue.get(key);
        if (!queued) return;

        // ✅ Releer clínica fresca desde DB
        const prisma = require("../lib/prisma");
        const freshClinic = await prisma.clinic.findUnique({
          where: { id: clinic.id }
        });

        if (!freshClinic || !freshClinic.adminPhone) {
          console.log("[clinicNotification] Clínica no encontrada o sin adminPhone");
          return;
        }

        if (!freshClinic.notificationsActive) {
          console.log("[clinicNotification] Notificaciones desactivadas");
          return;
        }

        const messageList = queued.messages
          .map((msg, i) => `${i + 1}. "${msg}"`)
          .join("\n");

        const count = queued.messages.length;

        const notification =
          `🔔 *Mensaje${count > 1 ? `s (${count})` : ""} de Paciente*\n\n` +
          `📱 Teléfono: ${phone}\n\n` +
          `💬 Mensaje${count > 1 ? "s" : ""}:\n${messageList}`;

        await sendWhatsAppMessage({
          accessToken: freshClinic.accessToken,      // ✅ Token fresco de DB
          phoneNumberId: freshClinic.phoneNumberId,
          to: freshClinic.adminPhone.trim(),         // ✅ trim por seguridad
          message: notification
        });

        console.log(`[clinicNotification] Resumen enviado — ${count} mensaje(s) — key: ${key}`);

      } catch (error) {
        console.error("[clinicNotification] Error enviando resumen:", error.message);
      } finally {
        notificationQueue.delete(key);
        console.log(`[clinicNotification] Cola liberada — key: ${key}`);
      }
    }, COOLDOWN_MS);

    notificationQueue.set(key, entry);
    console.log(`[clinicNotification] Nueva cola creada — key: ${key}`);

  } catch (error) {
    console.error("[clinicNotification] Error:", error.message);
  }
};

// Función para verificar notificaciones cada 5 minutos
const checkClinicNotifications = async () => {
  try {
    console.log("🔔 Checking for clinic notifications...");
    
    const prisma = require("../lib/prisma");
    
    // Obtener todas las clínicas con notificaciones activas
    const clinics = await prisma.clinic.findMany({
      where: {
        notificationsActive: true
      }
    });
    
    console.log(`Found ${clinics.length} clinics with notifications enabled`);
    
    // Aquí puedes agregar lógica adicional si necesitas verificar algo específico
    
  } catch (error) {
    console.error("Error checking clinic notifications:", error.message);
    console.error("❌ Stack:", error.stack);
  }
};

// Inicializar el sistema de notificaciones cada 5 minutos
const initializeClinicNotifications = () => {
  console.log("🚀 Initializing clinic notifications system...");
  
  // Ejecutar inmediatamente
  checkClinicNotifications();
  
  // Repetir cada 5 minutos
  setInterval(checkClinicNotifications, 5 * 60 * 1000);
};

// Auto-inicializar cuando se importa el módulo
initializeClinicNotifications();

module.exports = { evaluateClinicNotification };

module.exports = { evaluateClinicNotification };