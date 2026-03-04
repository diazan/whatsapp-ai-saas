const express = require('express');
const router = express.Router();
const { verifyWebhook, handleWebhook } = require("../controllers/webhookControllers");


// Verificación inicial de Meta
router.get("/", verifyWebhook);

// Recepción de mensajes
router.post("/", handleWebhook);

module.exports = router;