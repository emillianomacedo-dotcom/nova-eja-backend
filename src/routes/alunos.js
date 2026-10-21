import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { nome_completo, cpf, email } = req.body;
    if (!nome_completo || !cpf || !email) {
      return res.status(400).json({ ok: false, mensagem: "Campos obrigatorios: nome_completo, cpf, email" });
    }

    const { data: existente } = await supabase.from("alunos").select("*").eq("cpf", cpf).maybeSingle();
    if (existente) return res.json({ ok: true, aluno: existente, existente: true });

    const { data, error } = await supabase.from("alunos").insert({ nome_completo, cpf, email }).select().single();
    if (error) throw error;
    res.status(201).json({ ok: true, aluno: data, existente: false });
  } catch (e) { next(e); }
});

// Verifica se o CPF existe e se tem formulario em andamento para o segmento
router.post("/verificar", async (req, res, next) => {
  try {
    const { cpf, segmento } = req.body;
    if (!cpf) return res.status(400).json({ ok: false, mensagem: "CPF e obrigatorio" });

    const { data: aluno, error: errA } = await supabase.from("alunos").select("*").eq("cpf", cpf).maybeSingle();
    if (errA) throw errA;
    if (!aluno) return res.json({ ok: true, existe: false, aluno: null });

    // Busca formulario em andamento para o segmento
    const { data: formulario, error: errF } = await supabase
      .from("formularios")
      .select("*")
      .eq("aluno_id", aluno.id)
      .eq("segmento", segmento)
      .eq("status", "rascunho")
      .maybeSingle();

    if (errF) throw errF;

    res.json({ ok: true, existe: true, aluno: aluno, formulario_em_andamento: formulario || null });
  } catch (e) { next(e); }
});

export default router;
