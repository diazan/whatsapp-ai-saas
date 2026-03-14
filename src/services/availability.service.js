const prisma = require("../lib/prisma");
const { DateTime } = require("luxon");

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
    second: 0,
    millisecond: 0
  });

  const closeDateTime = date.set({
    hour: closeHour,
    minute: closeMinute,
    second: 0,
    millisecond: 0
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

  const now = DateTime.now().setZone(clinic.timeZone);

  while (cursor.plus({ minutes: service.durationMin }) <= closeDateTime) {

    // ✅ Si es hoy, no mostrar horarios pasados
    if (date.hasSame(now, "day") && cursor <= now) {
      cursor = cursor.plus({ minutes: service.durationMin });
      continue;
    }

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

    // ✅ Mantener máximo 3 sugerencias
    if (suggestions.length >= 3) break;
  }

  return suggestions;
};

module.exports = {
  getAvailableSlotsForDay
};