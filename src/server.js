require('dotenv').config();
const express = require('express');
const webhookRoutes = require('./routes/webhook');

const app = express();
app.use(express.json());

app.use('/webhook', webhookRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

app.get("/webhook", (req, res) => {
  const verifyToken = "estetica_verify_2026";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  console.log("Webhook recibido:");
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});