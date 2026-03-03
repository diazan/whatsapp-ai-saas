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