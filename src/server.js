console.log("🚀 SERVER STARTED");
require("dotenv").config();

const { startReminderJob } = require("./services/reminder.service");
const express = require("express");
const testRoutes = require("./routes/test.routes");
const webhookRoutes = require("./routes/webhook");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(express.json());

// ✅ Montar rutas
app.use("/api", testRoutes);
app.use("/webhook", webhookRoutes);
app.use("/admin", adminRoutes);

// Ruta base opcional
app.get("/", (req, res) => {
  res.send("SERVER MINIMO FUNCIONANDO");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  startReminderJob(); // ✅ iniciar cron
});