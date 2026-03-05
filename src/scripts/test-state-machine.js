import prisma from "../lib/prisma.js"
import { handleIncomingMessage } from "../services/conversation.state-machine.js"

async function main() {

  const clinic = await prisma.clinic.findFirst()

  if (!clinic) {
    console.log("❌ No hay clínicas")
    return
  }

  console.log("🏥 Clínica usada:", clinic.id)

  const sendMessage = async (text) => {
    console.log("\n🤖 BOT:\n")
    console.log(text)
  }

  const basePayload = {
    clinic,
    patientPhone: "521234567890",
    patientName: "Juan Perez",
    sendMessage
  }

  // 1️⃣ Mensaje inicial
  await handleIncomingMessage({
    ...basePayload,
    message: "quiero una cita"
  })

  // 2️⃣ Selección de servicio
  await handleIncomingMessage({
    ...basePayload,
    message: "1"
  })

  // 3️⃣ Selección de fecha
  await handleIncomingMessage({
    ...basePayload,
    message: "10/03/2026"
  })

  // 4️⃣ Hora
  await handleIncomingMessage({
    ...basePayload,
    message: "12:30"
  })

  const conversation = await prisma.conversation.findFirst({
  where: {
    clinicId: clinic.id,
    patientPhone: "521234567890"
  },
  orderBy: {
    createdAt: "desc"
  }
})

  console.log("\n📦 Estado actual conversación:")
  console.log(conversation.state)

  console.log("\n📦 Context actual:")
  console.log(conversation.context)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())