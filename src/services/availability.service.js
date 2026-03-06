const { DateTime } = require("luxon");
const prisma = require("../lib/prisma");

// Asegurarnos de usar la zona horaria de la clínica


// Convertir weekday (1-7) a formato 0-6


const validateClinicSchedule = async (clinicId, startAt, endAt) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId }
  });

  if (!clinic) {
    throw new Error("Clínica no encontrada");
  }

  const start = DateTime.fromJSDate(startAt).setZone(clinic.timeZone);
  const end   = DateTime.fromJSDate(endAt).setZone(clinic.timeZone);

  // ✅ CORRECTO: aplicar timezone antes de calcular weekday
  const dateTime = DateTime.fromJSDate(startAt)
    .setZone(clinic.timeZone);

  const dayOfWeek = dateTime.weekday % 7;

  const schedule = await prisma.clinicSchedule.findUnique({
    where: {
      clinicId_dayOfWeek: {
        clinicId: clinic.id,
        dayOfWeek
      }
    }
  });

  if (!schedule || !schedule.isActive) {
    throw new Error("La clínica no atiende ese día");
  }

  const startTime = start.toFormat("HH:mm");
  const endTime   = end.toFormat("HH:mm");

  if (startTime < schedule.openTime || endTime > schedule.closeTime) {
    throw new Error("Fuera del horario de atención");
  }

  return true;
};

module.exports = {
  validateClinicSchedule,
};

