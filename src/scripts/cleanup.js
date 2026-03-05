import { prisma } from "../lib/prisma.js"

async function main() {

  await prisma.conversation.deleteMany()

  await prisma.clinic.delete({
    where: {
      id: "1"
    }
  })

  console.log("✅ Clínica 1 eliminada y conversaciones limpiadas")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())