const prisma = require("../lib/prisma");
const { sendWhatsAppMessage } = require("./whatsappService");

const BOT_FLOW_KEYWORDS = ["1", "2", "3", "4", "0", "hola", "inicio", "si", "no"];

const evaluateSalesNotification = async ({
  phone,
  clinic,
  incomingMessage
}) => {
  try {
    const adminPhone = process.env.ADMIN_PHONE;
    if (!adminPhone) {
      console.log("[salesNotification] ADMIN_PHONE no configurado en .env");
      return;
    }

    // Ignorar palabras del flujo del bot
    if (BOT_FLOW_KEYWORDS.includes(incomingMessage.toLowerCase().trim())) {
      console.log("[salesNotification] Mensaje del flujo ignorado:", incomingMessage);
      return;
    }

    // Buscar demo más reciente de este prospecto
    const demo = await prisma.salesDemoRequest.findFirst({
      where: {
        phone,
        clinicId: clinic.id
      },
      orderBy: { createdAt: "desc" }
    });

    if (!demo) return;

    // Verificar notificaciones activas
    if (!demo.notificationsActive) {
      console.log("[salesNotification] Notificaciones desactivadas para demo:", demo.id);
      return;
    }

    // Desactivar automáticamente si ya fue aceptado o rechazado
    if (demo.status === "accepted" || demo.status === "rejected") {
      await prisma.salesDemoRequest.update({
        where: { id: demo.id },
        data: { notificationsActive: false }
      });
      console.log("[salesNotification] Notificaciones desactivadas automáticamente — demo:", demo.id);
      return;
    }

    const notification =
      `🔔 *Alerta de Demo — Ventas*\n\n` +
      `👤 *${demo.name}* (${phone})\n` +
      `📌 Estado: ${demo.status}\n\n` +
      `💬 Mensaje:\n_"${incomingMessage}"_`;

    await sendWhatsAppMessage({
      accessToken: clinic.accessToken,
      phoneNumberId: clinic.phoneNumberId,
      to: adminPhone,
      message: notification
    });

    console.log(`[salesNotification] Admin notificado — demo ${demo.id}`);

  } catch (error) {
    console.error("[salesNotification] Error:", error.message);
  }
};

module.exports = { evaluateSalesNotification };