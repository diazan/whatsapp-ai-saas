require("dotenv").config();

const express = require("express");

const testRoutes = require("./routes/test.routes");
const webhookRoutes = require("./routes/webhook");

const app = express();

app.use(express.json());

// ✅ Montar rutas
app.use("/api", testRoutes);
app.use("/webhook", webhookRoutes);

// Ruta base opcional
app.get("/", (req, res) => {
  res.send("SERVER MINIMO FUNCIONANDO");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});