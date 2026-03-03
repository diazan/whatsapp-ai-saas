const express = require("express");
const app = express();

app.use(express.json());

// ✅ Aquí definimos el verify token
const verifyToken = "estetica_verify_2026";
const axios = require("axios");
const PHONE_NUMBER_ID = "964814516722240";
const ACCESS_TOKEN = "EAARx19PbSFkBQ6CWVuFTzftWKvHQPfug5OIW0vEOCBogU4PCvMBhcZB6u98ZCqFAs9UO7ZAYOiZBnlbm8i7uZC8cP2ZC8j1VPfot1LWUwSPqGHdvOAtKP17gEnZAihRUDV5VfVJxLPWzQZAohwMQBZADPdJRzWPehx2L2aZAExfrpfwzBet0lJJsvyrZBM7AJ94UL12KTuh2d5ZAZBIlUjhNBXdO92EhdA5CaF4wQV6DzszLJQxC0oaJZBWsZBX";

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
    console.log("====== BODY COMPLETO ======");
    console.log(JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (
      body.object &&
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages
    ) {
      const message =
        body.entry[0].changes[0].value.messages[0];

      const from = message.from;
      const text = message.text?.body;

      console.log("Mensaje recibido de:", from);
      console.log("Texto:", text);

      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body: "Hola 👋 Esto es una prueba automática.",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Respuesta de Meta:", response.data);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ ERROR COMPLETO:");
    console.error(error.response?.data || error.message);
    res.sendStatus(500);
  }
});