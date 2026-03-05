const { DateTime } = require("luxon");
const prisma = require("../lib/prisma");

const validateClinicSchedule = async (clinicId, startAt, endAt) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId }
  });

  if (!clinic) {
    throw new Error("Clínica no encontrada");
  }

  const start = DateTime.fromJSDate(startAt).setZone(clinic.timeZone);
  const end   = DateTime.fromJSDate(endAt).setZone(clinic.timeZone);

  // Luxon: Monday=1...Sunday=7 → convertimos a 0=Sunday
  const dayOfWeek = start.weekday % 7;

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