const express = require('express');
const router = express.Router();

// Verificación inicial de Meta
router.get('/', (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === verify_token) {
    console.log('Webhook verificado correctamente');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// Recepción de mensajes
router.post('/', (req, res) => {
  console.log('Mensaje recibido:');
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

module.exports = router;