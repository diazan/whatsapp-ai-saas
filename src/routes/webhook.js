const express = require("express");
const router = express.Router();

const { handleWebhook } = require("../controllers/webhookControllers");

router.get("/", (req, res) => {

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("📩 GET WEBHOOK VERIFY");
  console.log("🔍 Webhook verification attempt");
  console.log("Mode:", mode);
  console.log("Token recibido:", token);
  console.log("Token esperado:", process.env.WEBHOOK_VERIFY_TOKEN);

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verificado correctamente");
    return res.status(200).send(challenge);
  }

  console.log("❌ Token incorrecto");
  return res.sendStatus(403);
});

// ✅ POST para mensajes
router.post("/", handleWebhook);

module.exports = router;