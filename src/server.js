console.log("🔑 ENV CHECK:", {
  WEBHOOK_VERIFY_TOKEN: process.env.VERIFY_TOKEN,
  DEMO_PHONE_NUMBER_ID: process.env.DEMO_PHONE_NUMBER_ID,
});
console.log("🚀 SERVER STARTED");
console.log("META_APP_ID:", process.env.META_APP_ID);
console.log("META_APP_SECRET length:", process.env.META_APP_SECRET?.length);
console.log("META_WABA_ID:", process.env.META_WABA_ID);



const express = require("express");
const { startReminderJob } = require("./services/reminder.service");
const cors = require("cors"); // ✅ agregar
const testRoutes = require("./routes/test.routes");
const logger = require('./utils/logger');
const webhookRoutes = require("./routes/webhook");
const requestLogger = require('./middleware/requestLogger');
const adminRoutes = require("./routes/admin.routes");
const startKeepAlive = require('./utils/keepAlive');
const app = express();
console.log("🚀 SERVER FILE ACTIVO");
console.log("🗄️ DATABASE_URL usada por la app:");
console.log(process.env.DATABASE_URL);



const allowedOrigins = [
  "http://localhost:3000",
  "https://www.kerbo.co",
  "https://kerbo.co",
  "https://whatsapp-admin-dashboard-git-main-diazans-projects.vercel.app"
];



app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(requestLogger);

// ────────────────────────────────────────
// Health check — infraestructura únicamente
// Sin auth, sin DB, sin lógica de negocio
// Usado para keep-alive y monitoreo externo
// ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});


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
console.log("📌 Mounting /webhook route");
app.use("/webhook", webhookRoutes);
console.log("✅ /webhook route mounted");
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("SERVER MINIMO FUNCIONANDO");
});
app.use("/admin", require("./routes/admin.routes"));
const PORT = 4000;

// Inicializar notificaciones clínicas (con manejo de error)
require('./services/clinicNotificationService');

const axios = require("axios");

app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing code");
  }

  try {
    // 1️⃣ Intercambiar code por token
    const tokenResponse = await axios.get(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri:
            "https://whatsapp-ai-saas-exgf.onrender.com/oauth/callback",
          code,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    console.log("✅ ACCESS TOKEN:", accessToken);

    // 2️⃣ Obtener info del system user
    const debugResponse = await axios.get(
      "https://graph.facebook.com/v19.0/debug_token",
      {
        params: {
          input_token: accessToken,
          access_token:
            process.env.META_APP_ID + "|" + process.env.META_APP_SECRET,
        },
      }
    );

    const systemUserId = debugResponse.data.data.user_id;

    console.log("✅ SYSTEM USER ID:", systemUserId);

    // 3️⃣ Obtener business del system user
    const systemUserResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${systemUserId}?fields=business`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const businessId = systemUserResponse.data.business.id;

    console.log("✅ BUSINESS ID:", businessId);

    // 4️⃣ Obtener WABAs
    const wabaResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${businessId}/owned_whatsapp_business_accounts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log(
      "✅ WABAs:",
      JSON.stringify(wabaResponse.data, null, 2)
    );

    const wabaId = wabaResponse.data.data[0].id;

    // 5️⃣ Obtener números
    const phoneResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log(
      "✅ PHONE NUMBERS:",
      JSON.stringify(phoneResponse.data, null, 2)
    );

    res.send("Integration data fetched. Check logs.");
  } catch (error) {
    console.error(
      "❌ ERROR:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Token exchange failed");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  startReminderJob();
  startKeepAlive();
});