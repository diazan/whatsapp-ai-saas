const { PrismaClient } = require("@prisma/client");
const { DateTime } = require("luxon");
const { sendWhatsAppMessage } = require("./whatsappService");

const prisma = new PrismaClient();

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

      const formattedDate = localStart.toFormat("cccc dd 'de' LLLL");
      const formattedTime = localStart.toFormat("hh:mm a");

      const message = `👋 Hola ${appointment.patientName}, te recordamos tu cita de *${service.name}* el ${formattedDate} a las ${formattedTime}.

      Responde con el número de la opción:

      1️⃣ Confirmar asistencia
      2️⃣ Cancelar cita`;
      const result = await sendWhatsAppMessage({
        accessToken: clinic.accessToken,
        phoneNumberId: clinic.phoneNumberId,
        to: appointment.patientPhone,
        message,
      });

      if (result.success) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { reminderSent: true },
        });

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