require("dotenv").config();

const { createAppointment } = require("../src/services/bookingService.js");
const prisma = require("../src/lib/prisma");

async function run() {
  try {

    // 🔎 1️⃣ Busca una clínica real
    const clinic = await prisma.clinic.findFirst();

    if (!clinic) {
      throw new Error("No clinics found in DB");
    }

    console.log("Clinic:", clinic.id, clinic.timeZone);

    // 🔎 2️⃣ Busca un servicio real
    const service = await prisma.service.findFirst({
      where: {
        clinicId: clinic.id,
        active: true
      }
    });

    if (!service) {
      throw new Error("No services found");
    }

    console.log("Service:", service.id, service.durationMin);

    // 🔎 3️⃣ Fecha manual futura
    const startAt = "2026-03-10T10:00:00";

    const appointment = await createAppointment({
      clinicId: clinic.id,
      serviceId: service.id,
      patientName: "Test User",
      patientPhone: "123456789",
      startAt
    });

    console.log("✅ Appointment created:", appointment);

  } catch (error) {
    console.error("❌ ERROR REAL:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();