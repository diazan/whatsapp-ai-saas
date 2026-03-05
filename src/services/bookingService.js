const { prisma } = require("../lib/prisma"); // ajusta según tu setup

const createAppointment = async ({
  tenantId,
  serviceId,
  patientName,
  patientPhone,
  startAt,
}) => {
  // 1️⃣ Obtener servicio
  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      tenantId,
      active: true,
    },
  });

  if (!service) {
    throw new Error("Service not found");
  }

  // 2️⃣ Calcular endAt
  const startDate = new Date(startAt);
  const endDate = new Date(
    startDate.getTime() + service.durationMin * 60 * 1000
  );

  // 3️⃣ Verificar solapamientos
  const overlapping = await prisma.appointment.findFirst({
    where: {
      tenantId,
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

  // 4️⃣ Crear cita
  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
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