console.log("🚀 SERVER STARTED");
require("dotenv").config();


const express = require("express");
const { startReminderJob } = require("./services/reminder.service");
const cors = require("cors"); // ✅ agregar
const testRoutes = require("./routes/test.routes");
const webhookRoutes = require("./routes/webhook");
const adminRoutes = require("./routes/admin.routes");
const app = express();
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});


app.use(express.json());

// ✅ Montar rutas
app.use("/api", testRoutes);
app.use("/webhook", webhookRoutes);
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("SERVER MINIMO FUNCIONANDO");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  startReminderJob();
});