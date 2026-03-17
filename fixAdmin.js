const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("Admin123!", 10);
  
  console.log("Hash generado:", hash);

  await prisma.clinic.update({
    where: { phoneNumberId: "993943513813000" },
    data: { passwordHash: hash }
  });

  console.log("✅ passwordHash actualizado correctamente");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());