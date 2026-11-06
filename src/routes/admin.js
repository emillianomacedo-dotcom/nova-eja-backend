import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

// 1. Listar todos os alunos
router.get("/alunos", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("alunos").select("*").order("nome_completo");
    if (error) throw error;
    res.json({ ok: true, alunos: data });
  } catch (e) { next(e); }
});

// 2. Bloquear/Desbloquear aluno
router.put("/alunos/:id/bloquear", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bloqueado } = req.body;
    const { data, error } = await supabase
      .from("alunos")
      .update({ acesso_bloqueado: bloqueado })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, aluno: data });
  } catch (e) { next(e); }
});

// 3. Buscar relatório (mensagens) do aluno
router.get("/alunos/:id/relatorio", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: form, error: errF } = await supabase
      .from("formularios")
      .select("*")
      .eq("aluno_id", id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (errF) throw errF;
    if (!form) return res.json({ ok: true, mensagens: [] });

    const { data: mensagens, error: errM } = await supabase
      .from("mensagens_chat")
      .select("*")
      .eq("formulario_id", form.id)
      .order("id");
      
    if (errM) throw errM;

    res.json({ ok: true, mensagens: mensagens || [] });
  } catch (e) { next(e); }
});

export default router;
