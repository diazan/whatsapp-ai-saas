require("dotenv").config();

const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("SERVER MINIMO FUNCIONANDO");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.use(express.json());
app.use("/webhook", require("./routes/webhook"));