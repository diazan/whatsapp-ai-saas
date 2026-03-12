require("dotenv").config();

const readline = require("readline");
const prisma = require("../src/lib/prisma");
const { handleSalesBotMessage } = require("../src/services/salesBot.service");

async function main() {

  // ✅ Obtener clinic demo (la única actual)
  const clinic = await prisma.clinic.findFirst();
  console.log("Clinic TimeZone:", clinic.timeZone);

  if (!clinic) {
    console.log("No clinic found.");
    process.exit(1);
  }

  const patientPhone = "573103827700";

  console.log("=== SALES BOT LOCAL TEST ===");
  console.log("Escribe mensajes como si fueras el prospecto.");
  console.log("Escribe 'exit' para salir.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("line", async (input) => {

    if (input.toLowerCase() === "exit") {
      await prisma.$disconnect();
      process.exit(0);
    }

    try {

      await handleSalesBotMessage({
        clinic,
        message: input,
        patientPhone,
        sendMessage: async (text) => {
          console.log("\nBOT:\n" + text + "\n");
        }
      });

    } catch (error) {
      console.error("Error:", error.message);
    }

  });
}

main();