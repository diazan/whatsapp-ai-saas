console.log("🚀 SERVER STARTED");
require("dotenv").config();




const express = require("express");
const { startReminderJob } = require("./services/reminder.service");
const cors = require("cors"); // ✅ agregar
const testRoutes = require("./routes/test.routes");
const logger = require('./utils/logger');
const webhookRoutes = require("./routes/webhook");
const requestLogger = require('./middleware/requestLogger');
const adminRoutes = require("./routes/admin.routes");
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://whatsapp-admin-dashboard-xxxx.vercel.app"
    ]
  })
);
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
];
app.use(express.json());
app.use(requestLogger);


logger.info('✅ Logger inicializado correctamente');

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


app.use(requestLogger);
// ✅ Montar rutas
app.use("/api", testRoutes);
app.use("/webhook", webhookRoutes);
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("SERVER MINIMO FUNCIONANDO");
});
app.use("/admin", require("./routes/admin.routes"));
const PORT = 4000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  startReminderJob();
});