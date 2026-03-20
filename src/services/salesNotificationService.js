const prisma = require("../lib/prisma");
const { sendWhatsAppMessage } = require("./whatsappService");
const { DateTime } = require("luxon");

const BOT_FLOW_KEYWORDS = ["1", "2", "3", "4", "0", "hola", "inicio", "si", "no"];

const SALES_CLINIC_ID = "sales-clinic-uuid-12345678";

const SALES_BOT_IGNORED_STATES = [
  "SALES_BOOKING_DATE",
  "SALES_BOOKING_TIME",
  "SALES_CUSTOM_TIME", 
  "SALES_ASK_NAME" // ← nombre que escribe el usuario
];

const evaluateSalesNotification = async ({
  phone,
  clinic,
  incomingMessage,
  conversationState = "SALES_IDLE"
}) => {
  try {
    console.log("[salesNotification] Evaluando mensaje:", incomingMessage);
    console.log("[salesNotification] Phone:", phone);

    const adminPhone = process.env.ADMIN_PHONE;
    if (!adminPhone) {
      console.log("[salesNotification] ADMIN_PHONE no configurado en .env");
      return;
    }

    if (BOT_FLOW_KEYWORDS.includes(incomingMessage.toLowerCase().trim())) {
      console.log("[salesNotification] Mensaje del flujo ignorado:", incomingMessage);
      return;
    }

        if (SALES_BOT_IGNORED_STATES.includes(conversationState)) {
      console.log("[salesNotification] Estado ignorado:", conversationState);
      return;
    }


    const demo = await prisma.salesDemoRequest.findFirst({
      where: {
        phone,
        clinicId: SALES_CLINIC_ID
      },
      orderBy: { createdAt: "desc" }
    });

    console.log("[salesNotification] Demo encontrada:", demo?.id);

    if (!demo) {
      console.log("[salesNotification] No existe demo para este prospecto");
      return;
    }

    // ✅ Verificar ventana de tiempo
    const now = DateTime.now().toUTC();
    const windowEnd = DateTime.fromJSDate(demo.preferredAt).toUTC().plus({ minutes: 15 });

    console.log("[salesNotification] now:", now.toISO());
    console.log("[salesNotification] windowEnd:", windowEnd.toISO());

    if (now > windowEnd) {
      await prisma.salesDemoRequest.update({
        where: { id: demo.id },
        data: { notificationsActive: false }
      });
      console.log("[salesNotification] Ventana expirada — notificaciones apagadas:", demo.id);
      return;
    }

    // ✅ Si status no es pending → apagar y salir
    if (demo.status !== "pending") {
      await prisma.salesDemoRequest.update({
        where: { id: demo.id },
        data: { notificationsActive: false }
      });
      console.log("[salesNotification] Status no-pending — notificaciones apagadas:", demo.id);
      return;
    }

    // ✅ Si es pending pero notificationsActive estaba apagado → reactivar
    if (!demo.notificationsActive) {
      await prisma.salesDemoRequest.update({
        where: { id: demo.id },
        data: { notificationsActive: true }
      });
      console.log("[salesNotification] Notificaciones reactivadas — demo:", demo.id);
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

    console.log("[salesNotification] Admin notificado — demo:", demo.id);

  } catch (error) {
    console.error("[salesNotification] Error:", error.message);
  }
};

module.exports = { evaluateSalesNotification };