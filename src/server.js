require("dotenv").config();

const express = require("express");
const app = express();

const testRoutes = require("./routes/test.routes");
app.use("/api", testRoutes);

app.use(express.json());

// ✅ MONTA RUTAS ANTES DE LISTEN
app.use("/webhook", require("./routes/webhook"));

// Ruta base opcional
app.get("/", (req, res) => {
  res.send("SERVER MINIMO FUNCIONANDO");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});