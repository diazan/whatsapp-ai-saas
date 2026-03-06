import prisma from "../lib/prisma.js"
import { getOrCreateConversation } from "../services/conversation.service.js"

async function main() {

  const clinic = await prisma.clinic.findFirst()

  if (!clinic) {
    console.log("❌ No hay clínicas en la base de datos")
    return
  }

  const conversation = await getOrCreateConversation({
    clinicId: clinic.id,
    patientPhone: "521234567890",
    patientName: "Juan Perez"
  })

  console.log("✅ Conversación creada o encontrada:")
  
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })