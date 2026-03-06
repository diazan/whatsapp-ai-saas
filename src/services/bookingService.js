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

  // 1️⃣ Obtener clínica (para timezone)
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
  console.log("START AT RECIBIDO:", startAt);
  // ✅ 3️⃣ Construir fecha correctamente en timezone de la clínica
  const startDateTime = DateTime.fromISO(startAt, {
    zone: clinic.timeZone,
  });

  if (!startDateTime.isValid) {
    throw new Error("Invalid date format");
  }

  const endDateTime = startDateTime.plus({
    minutes: service.durationMin,
  });

  const startDate = startDateTime.toJSDate();
  const endDate = endDateTime.toJSDate();

  // ✅ 4️⃣ Validar horario de clínica
  await validateClinicSchedule(clinicId, startDate, endDate);

  // 5️⃣ Verificar solapamientos
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

  // 6️⃣ Crear cita
  const appointment = await prisma.appointment.create({
    data: {
      clinicId,
      serviceId,
      patientName,
      patientPhone,
      startAt: startDate,
      endAt: endDate,
      status: "scheduled",
    },
  });

  return appointment;
};

module.exports = {
  createAppointment,
};