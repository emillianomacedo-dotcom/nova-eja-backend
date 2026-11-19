import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

// POST /api/chat/salvar - Salva uma mensagem (aluno ou ia)
router.post("/salvar", async (req, res, next) => {
  try {
    const { formulario_id, remetente, texto, habilidade_id, aba } = req.body;
    
    if (!formulario_id || !remetente || !texto) {
      return res.status(400).json({ ok: false, mensagem: "Dados incompletos" });
    }

    const { data, error } = await supabase
      .from("mensagens_chat")
      .insert({ formulario_id, remetente, texto, habilidade_id, aba })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ ok: true, mensagem: data });
  } catch (e) { next(e); }
});

// GET /api/chat/:formulario_id - Busca o histórico completo do chat
router.get("/:formulario_id", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("mensagens_chat")
      .select("*")
      .eq("formulario_id", req.params.formulario_id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ ok: true, mensagens: data });
  } catch (e) { next(e); }
});
// Salvar snapshot de autenticidade a cada mudança de formulário (autorizado pelo aluno)
router.post("/snapshot", async (req, res, next) => {
  try {
    const { formulario_id, aba, motivo, imagem_base64 } = req.body;
    if (!formulario_id || !imagem_base64) {
      return res.status(400).json({ ok: false, mensagem: "Dados incompletos" });
    }

    const { error } = await supabase.from("mensagens_chat").insert({
      formulario_id: formulario_id,
      remetente: "auditoria_camera",
      texto: JSON.stringify({
        motivo: motivo || "mudanca_formulario",
        data_hora: new Date().toISOString(),
        imagem: imagem_base64
      }),
      aba: aba || 1
    });

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
export default router;
