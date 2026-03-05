const prisma = require("../lib/prisma");
const { validateClinicSchedule } = require("./availability.service");

const createAppointment = async ({
  clinicId,
  serviceId,
  patientName,
  patientPhone,
  startAt,
}) => {

  // 1️⃣ Obtener servicio
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

  // 2️⃣ Calcular fechas
  const startDate = new Date(startAt);
  const endDate = new Date(
    startDate.getTime() + service.durationMin * 60 * 1000
  );

  // ✅ 3️⃣ Validar horario de clínica (ANTES de solapamientos)
  await validateClinicSchedule(clinicId, startDate, endDate);

  // 4️⃣ Verificar solapamientos
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

  // 5️⃣ Crear cita
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