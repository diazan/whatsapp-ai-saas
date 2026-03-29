const { DateTime } = require("luxon");
const { sendWhatsAppMessage } = require("./whatsappService");
const { getOrCreateConversation, updateConversation } = require("./conversation.service");
const prisma = require("../lib/prisma");


const REMINDER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

let isRunning = false; // evita ejecución simultánea

const processReminders = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    console.log("⏰ Checking 24h reminders...");

    const now = DateTime.utc();
    const windowStart = now.plus({ hours: 23 }).toJSDate();
    const windowEnd = now.plus({ hours: 24 }).toJSDate();

    const appointments = await prisma.appointment.findMany({
      where: {
        status: { in: ["scheduled", "confirmed"] },
        reminderSent: false,
        startAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        clinic: true,
        service: true,
      },
    });

    console.log(`📋 Found ${appointments.length} appointments for reminder`);

    for (const appointment of appointments) {
      const { clinic, service } = appointment;

      const localStart = DateTime.fromJSDate(appointment.startAt)
        .setZone(clinic.timeZone);

      const localStartEs = localStart.setLocale("es");
      const rawDate = localStartEs.toFormat("cccc dd 'de' LLLL");
      const formattedDate = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
      const formattedTime = localStart.toFormat("hh:mm a");

      const message = [
        `👋 Hola ${appointment.patientName}, te recordamos tu cita de *${service.name}* el ${formattedDate} a las ${formattedTime}.`,
        "",
        "Responde con el número de la opción:",
        "",
        "1️⃣ Confirmar asistencia",
        "2️⃣ Cancelar cita"
      ].join("\n");
      const result = await sendWhatsAppMessage({
        accessToken: clinic.accessToken,
        phoneNumberId: clinic.phoneNumberId,
        to: appointment.patientPhone,
        message,
      });

// DESPUÉS
if (result.success) {
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { reminderSent: true },
  });

  // ✅ Poner conversación en WAITING_REMINDER_RESPONSE y renovar expiresAt
  // para que el paciente pueda responder aunque pasen varios minutos
  const conversation = await getOrCreateConversation({
    clinicId: clinic.id,
    patientPhone: appointment.patientPhone,
    patientName: appointment.patientName
  });

  await updateConversation(conversation.id, {
    state: "WAITING_REMINDER_RESPONSE",
    context: { appointmentId: appointment.id }
  }, 30);

  console.log(`✅ Reminder sent for appointment ${appointment.id}`);
} else {
        console.error(
          `❌ Failed reminder for appointment ${appointment.id}`
        );
      }
    }
  } catch (error) {
    console.error("❌ Reminder job error:", error);
  } finally {
    isRunning = false;
  }
};

const startReminderJob = () => {
  console.log("🟢 Reminder scheduler started (every 5 minutes)");
  setInterval(processReminders, REMINDER_INTERVAL_MS);
};

module.exports = {
  startReminderJob,
};