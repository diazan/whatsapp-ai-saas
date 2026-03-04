require("dotenv").config();

if (!process.env.PHONE_NUMBER_ID || !process.env.ACCESS_TOKEN) {
  throw new Error("Missing required environment variables");
}

const express = require("express");
const webhookRoutes = require("./routes/webhook");
const app = express();

const prisma = require("./lib/prisma");

prisma.$connect()
  .then(() => console.log("✅ Connected to DB"))
  .catch((err) => console.error("❌ DB connection error", err));

console.log("🚀 VERSION NUEVA DEL SERVER CARGADA");

app.use(express.json());

app.use("/webhook", webhookRoutes);


// ✅ Aquí definimos el verify token
const verifyToken = "estetica_verify_2026";
const axios = require("axios");
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ✅ Endpoint de verificación
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ✅ Endpoint que recibe mensajes
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    console.log("📩 Evento recibido");

    const change = body.entry?.[0]?.changes?.[0]?.value;

    // ✅ Ignorar eventos que no son mensajes nuevos
    if (!change?.messages) {
      console.log("ℹ️ Evento sin mensaje (status u otro), ignorando...");
      return res.sendStatus(200);
    }

    const message = change.messages[0];

    // ✅ Solo responder a mensajes de texto
    if (message.type !== "text") {
      console.log("ℹ️ No es mensaje de texto, ignorando...");
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text.body;

    console.log("✅ Mensaje real recibido de:", from);
    console.log("✅ Texto:", text);

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: {
          body: "🔥 Ahora sí estoy respondiendo correctamente.",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Respuesta enviada:", response.data);

    res.sendStatus(200);

  } catch (error) {
    console.error("❌ ERROR COMPLETO:");
    console.error(error.response?.data || error.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});