require("dotenv").config();
const prisma = require("./src/lib/prisma"); // ajusta ruta si es necesario
const { validateClinicSchedule } = require("./src/services/availability.service"); // ajusta ruta

async function test() {
  try {
    const clinicId = "3b1995d7-f764-4e59-9f0e-ff0b82900f29";

    // ✅ Fecha que sabes que es LUNES
    const startAt = new Date("2026-03-09T15:00:00.000Z"); 
    const endAt   = new Date("2026-03-09T16:00:00.000Z");

    const result = await validateClinicSchedule(clinicId, startAt, endAt);

    console.log("✅ VALIDACIÓN EXITOSA", result);
  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();