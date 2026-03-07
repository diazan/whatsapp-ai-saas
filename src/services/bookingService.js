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

  if (!startDateTime.isValid) {
    throw new Error("Invalid date format");
  }

  // ✅ 4️⃣ Evitar citas en el pasado (timezone clínica)
  const nowInClinicTz = DateTime.now().setZone(clinic.timeZone);

  if (startDateTime <= nowInClinicTz) {
    throw new Error("Cannot book in the past");
  }

  const endDateTime = startDateTime.plus({
    minutes: service.durationMin,
  });

  const startDate = startDateTime.toJSDate();
  const endDate = endDateTime.toJSDate();

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

  return appointment;
};

module.exports = {
  createAppointment,
};