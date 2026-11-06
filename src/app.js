/* ============================================================
   Nova EJA - App Express (rotas + middlewares)
   ============================================================ */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

// Importação das rotas
import alunosRoutes from "./routes/alunos.js";
import formulariosRoutes from "./routes/formularios.js";
import experienciasRoutes from "./routes/experiencias.js";
import iaRoutes from "./routes/ia.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js"; // <-- IMPORTANTE: Adicionado aqui

import { errorHandler } from "./middlewares/errorHandler.js";

// Inicializa as variáveis de ambiente
dotenv.config();

// Cria a aplicação Express
const app = express();

// ---------- CORS ----------
const origensPermitidas = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: origensPermitidas.length > 0 ? origensPermitidas : "*"
}));

// Configurações de segurança e parseamento de JSON
app.use(helmet());
app.use(express.json());

// ---------- ROTAS DA API ----------
app.use("/api/alunos", alunosRoutes);
app.use("/api/formularios", formulariosRoutes);
app.use("/api/experiencias", experienciasRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api/chat", chatRoutes);

// ROTA DO ADMINISTRADOR (PAINEL DO COORDENADOR)
app.use("/api/admin", adminRoutes); // <-- IMPORTANTE: Adicionado aqui

// ---------- MIDDLEWARE DE ERRO ----------
app.use(errorHandler);

export default app;