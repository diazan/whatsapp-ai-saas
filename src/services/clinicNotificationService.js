const { sendWhatsAppMessage } = require("./whatsappService");

const CLINIC_FLOW_KEYWORDS = [
  "0", "1", "2", "3", "4",
  "hola", "inicio",
  "cita", "turno", "agendar", "reservar"
];

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

// Map en memoria: clave = "clinicId:phone"
// valor = { messages: [], timer }
const notificationQueue = new Map();

const evaluateClinicNotification = async ({
  phone,
  clinic,
  incomingMessage
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

    // Ignorar palabras del flujo del bot
    if (CLINIC_FLOW_KEYWORDS.includes(incomingMessage.toLowerCase().trim())) {
      console.log("[clinicNotification] Mensaje del flujo ignorado:", incomingMessage);
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

        const messageList = queued.messages
          .map((msg, i) => `${i + 1}. "${msg}"`)
          .join("\n");

        const count = queued.messages.length;

        const notification =
          `🔔 *Mensaje${count > 1 ? `s (${count})` : ""} de Paciente*\n\n` +
          `📱 Teléfono: ${phone}\n\n` +
          `💬 Mensaje${count > 1 ? "s" : ""}:\n${messageList}`;

        await sendWhatsAppMessage({
          accessToken: clinic.accessToken,
          phoneNumberId: clinic.phoneNumberId,
          to: clinic.adminPhone,
          message: notification
        });

        console.log(`[clinicNotification] Resumen enviado — ${count} mensaje(s) — key: ${key}`);

      } catch (error) {
        console.error("[clinicNotification] Error enviando resumen:", error.message);
      } finally {
        // Liberar memoria siempre
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

module.exports = { evaluateClinicNotification };