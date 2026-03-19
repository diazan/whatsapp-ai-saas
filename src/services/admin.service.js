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
  page,
  pageSize,
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
      // Fix para años corruptos (0002 → 2026)
      const correctedFrom = from.replace(/^000?2/, '2026');
      const fromDate = DateTime.fromISO(correctedFrom, { zone: timeZone })
        .startOf("day")
        .toUTC()
        .toJSDate();

      where.startAt.gte = fromDate;
    }

    if (to) {
      // Fix para años corruptos (0002 → 2026)  
      const correctedTo = to.replace(/^000?2/, '2026');
      const toDate = DateTime.fromISO(correctedTo, { zone: timeZone })
        .endOf("day")
        .toUTC()
        .toJSDate();

      where.startAt.lte = toDate;
    }
      }

  // ✅ Paginación segura (compatible hacia atrás)
  const currentPage =
    page && Number(page) > 0 ? Number(page) : null;

  const take =
    pageSize && Number(pageSize) > 0
      ? Number(pageSize)
      : 20;

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        service: true,
      },
      orderBy: {
        startAt: "desc",
      },
      skip: currentPage
        ? (currentPage - 1) * take
        : undefined,
      take: currentPage ? take : undefined,
    }),
    prisma.appointment.count({ where }),
  ]);

  // ✅ Métricas de asistencia
  const [attendedCount, noShowCount] = await Promise.all([
    prisma.appointment.count({
      where: {
        ...where,
        status: "attended",
      },
    }),
    prisma.appointment.count({
      where: {
        ...where,
        status: "no_show",
      },
    }),
  ]);

  const totalFinalized = attendedCount + noShowCount;

  const noShowRate =
    totalFinalized > 0
      ? Number(((noShowCount / totalFinalized) * 100).toFixed(2))
      : 0;

  return {
    data: appointments,
    total,
    page: currentPage,
    pageSize: currentPage ? take : null,
    metrics: {
      attended: attendedCount,
      noShow: noShowCount,
      noShowRate,
    },
  };
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

  // ✅ No permitir marcar asistencia si la cita es futura
  if (
    (status === "attended" || status === "no_show") &&
    appointment.startAt > now
  ) {
    throw new Error(
      "Cannot mark attendance for a future appointment"
    );
  }

  // ✅ No permitir cambiar estado si ya está finalizado
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