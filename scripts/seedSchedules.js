import prisma from "../src/lib/prisma.js"; // ajusta ruta si es diferente

async function seedSchedules() {
  const clinics = await prisma.clinic.findMany();

  for (const clinic of clinics) {
    console.log(`Creando horarios para clínica: ${clinic.name}`);

    const existing = await prisma.clinicSchedule.findFirst({
      where: { clinicId: clinic.id }
    });

    if (existing) {
      console.log("Ya tiene horarios, se omite.");
      continue;
    }

    const defaultSchedule = [
      { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", isActive: true },
      { dayOfWeek: 2, openTime: "09:00", closeTime: "18:00", isActive: true },
      { dayOfWeek: 3, openTime: "09:00", closeTime: "18:00", isActive: true },
      { dayOfWeek: 4, openTime: "09:00", closeTime: "18:00", isActive: true },
      { dayOfWeek: 5, openTime: "09:00", closeTime: "18:00", isActive: true },
      { dayOfWeek: 6, openTime: "09:00", closeTime: "14:00", isActive: true },
      { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isActive: false }
    ];

    for (const day of defaultSchedule) {
      await prisma.clinicSchedule.create({
        data: {
          clinicId: clinic.id,
          ...day
        }
      });
    }

    console.log("✅ Horarios creados");
  }

  console.log("🎯 Proceso terminado");
  process.exit(0);
}

seedSchedules().catch((error) => {
  console.error(error);
  process.exit(1);
});