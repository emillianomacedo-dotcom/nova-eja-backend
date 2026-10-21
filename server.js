/* ============================================================
   Nova EJA - Servidor Principal
   ============================================================ */

import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Nova EJA backend rodando na porta " + PORT);
  console.log("Healthcheck: http://localhost:" + PORT + "/health");
});
