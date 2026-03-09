const prisma = require("../lib/prisma");
const bcrypt = require("bcryptjs");
const { DateTime } = require("luxon");

const loginClinic = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error("Email and password required");
  }

  const clinic = await prisma.clinic.findUnique({
    where: { email },
  });

  if (!clinic || !clinic.passwordHash) {
    throw new Error("Invalid credentials");
  }

  const isValidPassword = await bcrypt.compare(
    password,
    clinic.passwordHash
  );

  if (!isValidPassword) {
    throw new Error("Invalid credentials");
  }

  return clinic;
};

const getAppointments = async ({
  clinicId,
  from,
  to,
  status,
  timeZone,
}) => {
  const where = {
    clinicId,
  };

  // ✅ Filtro por estado
  if (status) {
    where.status = status;
  }

  // ✅ Filtro por rango de fechas
  if (from || to) {
    where.startAt = {};

    if (from) {
      const fromDate = DateTime.fromISO(from, { zone: timeZone })
        .startOf("day")
        .toUTC()
        .toJSDate();

      where.startAt.gte = fromDate;
    }

    if (to) {
      const toDate = DateTime.fromISO(to, { zone: timeZone })
        .endOf("day")
        .toUTC()
        .toJSDate();

      where.startAt.lte = toDate;
    }
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      service: true,
    },
    orderBy: {
      startAt: "asc",
    },
  });

  return appointments;
};

const updateAppointmentStatus = async ({
  clinicId,
  appointmentId,
  status,
}) => {
  const allowedStatuses = [
    "scheduled",
    "confirmed",
    "cancelled",
    "attended",
    "no_show",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid status");
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      clinicId,
    },
  });

  if (!appointment) {
    throw new Error("Appointment not found");
  }

  const now = new Date();

  // ✅ Reglas de negocio

  // No permitir marcar asistencia si la cita es futura
  if (
    (status === "attended" || status === "no_show") &&
    appointment.startAt > now
  ) {
    throw new Error(
      "Cannot mark attendance for a future appointment"
    );
  }

  // No permitir cambiar estado si ya está finalizado
  if (
    appointment.status === "attended" ||
    appointment.status === "no_show"
  ) {
    throw new Error("Cannot modify a finalized appointment");
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });

  return updated;
};

module.exports = {
  loginClinic,
  getAppointments,
  updateAppointmentStatus,
};