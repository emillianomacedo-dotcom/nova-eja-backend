import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();

// 1. Criar ou buscar aluno
router.post("/", async (req, res, next) => {
  try {
    const { nome_completo, email } = req.body;
    let { cpf } = req.body;

    if (!nome_completo || !cpf || !email) {
      return res.status(400).json({ ok: false, mensagem: "Campos obrigatorios: nome_completo, cpf, email" });
    }

    // Formata o CPF para salvar COM máscara (padrão do banco)
    const cpfNumeros = cpf.replace(/\D/g, '');
    cpf = cpfNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    // Verifica se já existe com máscara
    let { data: existente } = await supabase.from("alunos").select("*").eq("cpf", cpf).maybeSingle();
    
    // Se não achou, verifica sem máscara (para evitar duplicidade em bancos misturados)
    if (!existente) {
        const { data: existenteSemMascara } = await supabase.from("alunos").select("*").eq("cpf", cpfNumeros).maybeSingle();
        existente = existenteSemMascara;
    }

    if (existente) {
      return res.json({ ok: true, aluno: existente, existente: true });
    }

    // Se não existe, cria um novo com máscara
    const { data, error } = await supabase.from("alunos").insert({ nome_completo, cpf, email }).select().single();
    if (error) throw error;
    
    res.status(201).json({ ok: true, aluno: data, existente: false });
  } catch (e) { next(e); }
});

// 2. Verifica se o CPF existe e se tem formulario em andamento
router.post("/verificar", async (req, res, next) => {
  try {
    const { cpf, segmento } = req.body;
    if (!cpf) return res.status(400).json({ ok: false, mensagem: "CPF e obrigatorio" });

    const cpfNumeros = cpf.replace(/\D/g, '');
    const cpfFormatado = cpfNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    // Tenta buscar com a máscara primeiro
    let { data: aluno, error: errA } = await supabase.from("alunos").select("*").eq("cpf", cpfFormatado).maybeSingle();
    
    // Se não encontrar, tenta buscar só com números
    if (!aluno) {
      const { data: alunoSemMascara, error: errB } = await supabase.from("alunos").select("*").eq("cpf", cpfNumeros).maybeSingle();
      if (errB) throw errB;
      aluno = alunoSemMascara;
    }

    if (errA) throw errA;
    if (!aluno) return res.json({ ok: true, existe: false, aluno: null });

    // BUSCA O ÚLTIMO FORMULÁRIO (para pegar turma e segmento)
    const { data: ultimoFormulario, error: errUltimo } = await supabase
      .from("formularios")
      .select("*")
      .eq("aluno_id", aluno.id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errUltimo) throw errUltimo;

    // Busca formulário em andamento para o segmento (se houver)
    const { data: formularioEmAndamento, error: errF } = await supabase
      .from("formularios")
      .select("*")
      .eq("aluno_id", aluno.id)
      .eq("segmento", segmento)
      .eq("status", "rascunho")
      .maybeSingle();

    if (errF) throw errF;

    res.json({ 
      ok: true, 
      existe: true, 
      aluno: aluno, 
      formulario_em_andamento: formularioEmAndamento || null,
      ultimo_formulario: ultimoFormulario || null
    });
  } catch (e) { next(e); }
});

export default router;