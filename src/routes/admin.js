import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

// 1. Listar todos os alunos (agora com a turma do último formulário)
router.get("/alunos", async (req, res, next) => {
  try {
    // Busca os alunos e os formulários deles
    const { data, error } = await supabase
      .from("alunos")
      .select(`
        *,
        formularios (
          turma
        )
      `)
      .order("nome_completo");

    if (error) throw error;

    // Formata os dados para o Frontend não ter trabalho
    const alunosFormatados = data.map(aluno => {
      // Pega a turma do formulário mais recente (se existir)
      const turmas = aluno.formularios.map(f => f.turma);
      const turmaAtual = turmas.length > 0 ? turmas[turmas.length - 1] : "Sem turma";

      return {
        id: aluno.id,
        nome_completo: aluno.nome_completo,
        cpf: aluno.cpf,
        acesso_bloqueado: aluno.acesso_bloqueado,
        turma: turmaAtual
      };
    });

    res.json({ ok: true, alunos: alunosFormatados });
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
    if (!form) return res.json({ ok: true, mensagens: [], formulario: null });

    const { data: mensagens, error: errM } = await supabase
      .from("mensagens_chat")
      .select("*")
      .eq("formulario_id", form.id)
      .order("id");
      
    if (errM) throw errM;

    res.json({ ok: true, mensagens: mensagens || [], formulario: form });
  } catch (e) { next(e); }
});

// 4. Deletar aluno (e seus registros vinculados em cascata)
router.delete("/alunos/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Deleta as mensagens do aluno (se existirem formulários)
    const { data: formularios } = await supabase.from("formularios").select("id").eq("aluno_id", id);
    if (formularios && formularios.length > 0) {
      const idsFormularios = formularios.map(f => f.id);
      await supabase.from("mensagens_chat").delete().in("formulario_id", idsFormularios);
      await supabase.from("habilidades_reconhecidas").delete().in("formulario_id", idsFormularios);
    }

    // 2. Deleta os formulários do aluno
    await supabase.from("formularios").delete().eq("aluno_id", id);

    // 3. Deleta o aluno
    const { error } = await supabase.from("alunos").delete().eq("id", id);
    if (error) throw error;

    res.json({ ok: true, mensagem: "Aluno e registros deletados com sucesso." });
  } catch (e) { next(e); }
});

export default router;
