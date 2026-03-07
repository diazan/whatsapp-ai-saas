const express = require("express");
const router = express.Router();

const { handleWebhook } = require("../controllers/webhookControllers");

// ✅ GET para verificación de Meta
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ✅ POST para mensajes
router.post("/", handleWebhook);

module.exports = router;