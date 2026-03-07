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

  console.log("DEBUG HORARIO:", {
    startISO: start.toISO(),
  });
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

// Convertir todo a minutos para comparación segura
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes   = end.hour * 60 + end.minute;

  const [openHour, openMinute] = schedule.openTime.split(":").map(Number);
  const [closeHour, closeMinute] = schedule.closeTime.split(":").map(Number);

  const openMinutes  = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    throw new Error("Fuera del horario de atención");
  }

  return true;
};



const getAvailableSlotsForDay = async ({
  clinicId,
  serviceId,
  dateISO
}) => {

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId }
  });

  if (!clinic) return [];

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      clinicId,
      active: true
    }
  });

  if (!service) return [];

  const date = DateTime.fromISO(dateISO, { zone: clinic.timeZone });

  const dayOfWeek = date.weekday % 7;

  const schedule = await prisma.clinicSchedule.findUnique({
    where: {
      clinicId_dayOfWeek: {
        clinicId,
        dayOfWeek
      }
    }
  });

  if (!schedule || !schedule.isActive) return [];

  const [openHour, openMinute] = schedule.openTime.split(":").map(Number);
  const [closeHour, closeMinute] = schedule.closeTime.split(":").map(Number);

  let cursor = date.set({
    hour: openHour,
    minute: openMinute,
    second: 0
  });

  const closeDateTime = date.set({
    hour: closeHour,
    minute: closeMinute,
    second: 0
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId,
      startAt: {
        gte: cursor.toJSDate(),
        lt: closeDateTime.toJSDate()
      },
      status: {
        in: ["scheduled", "confirmed"]
      }
    }
  });

  const suggestions = [];

  while (cursor.plus({ minutes: service.durationMin }) <= closeDateTime) {

    const slotEnd = cursor.plus({ minutes: service.durationMin });

    const overlap = appointments.find(a => {
      const aStart = DateTime.fromJSDate(a.startAt).setZone(clinic.timeZone);
      const aEnd   = DateTime.fromJSDate(a.endAt).setZone(clinic.timeZone);

      return cursor < aEnd && slotEnd > aStart;
    });

    if (!overlap) {
      suggestions.push(cursor.toFormat("HH:mm"));
    }

    cursor = cursor.plus({ minutes: service.durationMin });

    if (suggestions.length >= 3) break;
  }

  return suggestions;
};

module.exports = {
  validateClinicSchedule,
  getAvailableSlotsForDay
};
