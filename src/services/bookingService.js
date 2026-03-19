const prisma = require("../lib/prisma");
const { DateTime } = require("luxon");
const { validateClinicSchedule } = require("./availability.service");

const createAppointment = async ({
  clinicId,
  serviceId,
  patientName,
  patientPhone,
  startAt,
}) => {

  // ✅ 0️⃣ Validaciones básicas
  if (!clinicId || !serviceId || !startAt) {
    throw new Error("Missing required booking data");
  }

  if (!patientName || typeof patientName !== "string") {
    throw new Error("Invalid patient name");
  }

  const cleanName = patientName.trim();

  if (cleanName.length < 2 || cleanName.length > 100) {
    throw new Error("Invalid patient name");
  }

  // 1️⃣ Obtener clínica
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
  });

  if (!clinic) {
    throw new Error("Clinic not found");
  }

  // 2️⃣ Obtener servicio
  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      clinicId,
      active: true,
    },
  });

  if (!service) {
    throw new Error("Service not found");
  }

  // ✅ 3️⃣ Construir fecha en timezone correcta
  const startDateTime = DateTime.fromISO(startAt, {
    zone: clinic.timeZone,
    setZone: true,
  });

  console.log("🟢 START ISO:", startDateTime.toISO());


if (!startDateTime.isValid) {
  throw new Error("Invalid date format");
}

const nowInClinicTz = DateTime.now().setZone(clinic.timeZone);
const minimumStartTime = nowInClinicTz.plus({ minutes: 5 });

if (startDateTime < minimumStartTime) {
  throw new Error("Cannot book with less than 5 minutes notice");
}

const endDateTime = startDateTime.plus({
  minutes: service.durationMin,
});

const startDate = startDateTime.toJSDate(); // ✅ Declaración
const endDate = endDateTime.toJSDate();

console.log("🟢 START JS:", startDate); // ✅ Ahora sí puede usarse

  // ✅ 5️⃣ Validar horario de clínica
  await validateClinicSchedule(clinicId, startDate, endDate);

  // ✅ 6️⃣ Verificar solapamientos
  const overlapping = await prisma.appointment.findFirst({
    where: {
      clinicId,
      status: {
        in: ["scheduled", "confirmed"],
      },
      startAt: {
        lt: endDate,
      },
      endAt: {
        gt: startDate,
      },
    },
  });

  if (overlapping) {
    throw new Error("Time slot not available");
  }

  // ✅ 7️⃣ Crear cita
  const appointment = await prisma.appointment.create({
    data: {
      clinicId,
      serviceId,
      patientName: cleanName,
      patientPhone,
      startAt: startDate,
      endAt: endDate,
      status: "scheduled",
    },
  });

  console.log("🟡 NOW ISO:", nowInClinicTz.toISO());

  return appointment;
};

const rescheduleAppointment = async ({
  appointmentId,
  clinicId,
  serviceId,
  newStartAt
}) => {

  if (!appointmentId || !clinicId || !serviceId || !newStartAt) {
    throw new Error("Missing required reschedule data");
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
  });

  if (!clinic) {
    throw new Error("Clinic not found");
  }

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      clinicId,
      active: true,
    },
  });

  if (!service) {
    throw new Error("Service not found");
  }

  const startDateTime = DateTime.fromISO(newStartAt, {
    zone: clinic.timeZone,
    setZone: true,
  });

  console.log("🟢 START ISO:", startDateTime.toISO());

  if (!startDateTime.isValid) {
    throw new Error("Invalid date format");
  }

  const nowInClinicTz = DateTime.now().setZone(clinic.timeZone);

  console.log("🟡 NOW ISO:", nowInClinicTz.toISO());

  // ✅ Buffer mínimo de 5 minutos
  const minimumStartTime = nowInClinicTz.plus({ minutes: 5 });

  if (startDateTime < minimumStartTime) {
    throw new Error("Cannot book with less than 5 minutes notice");
  }

  const endDateTime = startDateTime.plus({
    minutes: service.durationMin,
  });

  const startDate = startDateTime.toJSDate();
  const endDate = endDateTime.toJSDate();

  console.log("🟠 VALIDATING SCHEDULE...");

  await validateClinicSchedule(clinicId, startDate, endDate);

  console.log("✅ SCHEDULE VALID");


  const overlapping = await prisma.appointment.findFirst({
    where: {
      clinicId,
      id: { not: appointmentId }, // ✅ EXCLUIR MISMA CITA
      status: {
        in: ["scheduled", "confirmed"],
      },
      startAt: {
        lt: endDate,
      },
      endAt: {
        gt: startDate,
      },
    },
  });

  console.log("🔵 OVERLAPPING RESULT:", overlapping);

  if (overlapping) {
    throw new Error("Time slot not available");
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      startAt: startDate,
      endAt: endDate,
    },
  });

  return updated;
};

const cancelNextUpcomingAppointment = async ({
  clinicId,
  patientPhone
}) => {

  if (!clinicId || !patientPhone) {
    throw new Error("Missing required cancel data");
  }

  const now = new Date();

  const appointment = await prisma.appointment.findFirst({
    where: {
      clinicId,
      patientPhone,
      status: {
        in: ["scheduled", "confirmed"]
      },
      startAt: {
        gte: now
      }
    },
    orderBy: {
      startAt: "asc"
    }
  });

  if (!appointment) {
    return null;
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: "cancelled"
    }
  });

  return updated;
};

const getNextUpcomingAppointment = async ({
  clinicId,
  patientPhone
}) => {

  if (!clinicId || !patientPhone) {
    throw new Error("Missing required data");
  }

  const now = new Date();

  const appointment = await prisma.appointment.findFirst({
    where: {
      clinicId,
      patientPhone,
      status: {
        in: ["scheduled", "confirmed"]
      },
      startAt: {
        gte: now
      }
    },
    orderBy: {
      startAt: "asc"
    }
  });

  return appointment;
};

const getReminderWindowAppointment = async ({
  clinicId,
  patientPhone
}) => {

  if (!clinicId || !patientPhone) {
    throw new Error("Missing required data");
  }

  const now = new Date();

  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const appointment = await prisma.appointment.findFirst({
    where: {
      clinicId,
      patientPhone,
      status: "scheduled",
      startAt: {
        gte: windowStart,
        lte: windowEnd
      }
    },
    orderBy: {
      startAt: "asc"
    }
  });

  return appointment;
};

module.exports = {
  createAppointment,
  rescheduleAppointment,
  cancelNextUpcomingAppointment,
  getNextUpcomingAppointment,
  getReminderWindowAppointment
};