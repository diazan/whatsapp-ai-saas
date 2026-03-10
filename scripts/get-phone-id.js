const prisma = require("../src/lib/prisma");

async function main() {
  const clinics = await prisma.clinic.findMany();
  console.log(clinics);
}

main().finally(() => prisma.$disconnect());