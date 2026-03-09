require("dotenv").config();
const path = require("path");
const bcrypt = require("bcryptjs");

// ✅ Resolver ruta absoluta al prisma
const prisma = require("../src/lib/prisma");
async function main() {
  const clinicId = "3b1995d7-f764-4e59-9f0e-ff0b82900f29";

  const email = "admin@clinicademo.com";
  const plainPassword = "Admin12345";

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      email,
      passwordHash,
    },
  });

  console.log("✅ Admin creado correctamente");
  console.log("Email:", email);
  console.log("Password:", plainPassword);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });