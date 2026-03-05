import prisma from "../src/lib/prisma.js";
import { validateClinicSchedule } from "../src/services/availability.service.js";

async function test() {
  const clinic = await prisma.clinic.findFirst();

  // Ejemplo: lunes 10:00
  const start = new Date("2026-03-09T10:00:00");
  const end   = new Date("2026-03-09T10:30:00");

  try {
    await validateClinicSchedule(clinic.id, start, end);
    console.log("✅ Horario válido");
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  process.exit(0);
}

test();