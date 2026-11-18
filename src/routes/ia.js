/* ============================================================
   Nova EJA - Rotas de IA
   ============================================================ */

import { Router } from "express";
import { analisar, chat, validarFinal } from "../controllers/iaController.js";

const router = Router();

router.post("/analisar", analisar);
router.post("/chat", chat);
router.post("/validar-final", validarFinal);

// Healthcheck simples da IA
router.get("/", (req, res) => {
  res.json({ ok: true, mensagem: "Rota de IA ativa", endpoints: ["/analisar", "/chat", "/validar-final"] });
});

export default router;
