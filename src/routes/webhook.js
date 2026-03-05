const express = require("express");
const router = express.Router();
const { handleWebhook } = require("../controllers/webhookControllers");

router.post("/", handleWebhook);

module.exports = router;