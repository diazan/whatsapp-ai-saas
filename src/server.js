require("dotenv").config();

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

const express = require("express");
const prisma = require("./lib/prisma");
const webhookRoutes = require("./routes/webhook");

const app = express();

// ✅ Middleware
app.use(express.json());

// ✅ Conexión a base de datos
prisma.$connect()
  .then(() => console.log("✅ Connected to DB"))
  .catch((err) => {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  });

// ✅ Rutas
app.use("/webhook", webhookRoutes);

// ✅ Health check (muy recomendado en Render)
app.get("/", (req, res) => {
  res.status(200).send("✅ WhatsApp SaaS running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});