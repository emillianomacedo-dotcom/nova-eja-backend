import { chamarIA } from "../config/providers.js";
import { getPromptSistema, getPromptValidacaoFinal } from "../services/prompts.js";
import { supabase } from "../config/supabase.js";

const TITULOS_FORMULARIOS = {
  1: "Formulário 1: História de Vida",
  2: "Formulário 2: Tempo Livre",
  3: "Formulário 3: Atividades Sociais",
  4: "Formulário 4: Experiência Profissional",
  5: "Formulário 5: Linguagens",
  6: "Formulário 6: Matemática",
  7: "Formulário 7: Ciências da Natureza",
  8: "Formulário 8: Ciências Humanas"
};

export const analisar = async (req, res, next) => {
  try {
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });

    const respostaObj = await chamarIA({
      promptSistema: `Você é o Tutor IA da Nova EJA. Analise o texto e responda de forma breve e neutra.`,
      mensagens: [{ role: "user", content: texto }]
    });

    res.json({ ok: true, resposta: respostaObj.texto });
  } catch (error) {
    next(error);
  }
};

export const chat = async (req, res, next) => {
  try {
    const { texto, historico, aba, segmento } = req.body;

    if (!texto) {
      return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });
    }

    // Limpa o histórico para remover comandos manuais e tags de controle
    const mensagens = (historico || [])
      .filter(m => !m.content.match(/^(próximo formulário|proximo formulario|próximo bloco|proximo bloco|prosseguir|ok|continuar|pode ir|avançar|avancar)$/i))
      .map(m => ({
        role: m.role,
        content: m.content
          .replace(/\[MATRIZ:.*?\]/g, "")
          .replace(/\[FIM_FORMULARIO\]/g, "")
          .replace(/\[FIM_BLOCO\]/g, "")
          .trim()
      }));

    if (mensagens.length === 0) {
      mensagens.push({ role: "user", content: texto });
    }

    const promptSistema = getPromptSistema(segmento, aba);

    const respostaObj = await chamarIA({
      promptSistema: promptSistema,
      mensagens: mensagens
    });

    const respostaIA = respostaObj.texto;

    res.json({
      ok: true,
      resposta: respostaIA,
      habilidade_id: null
    });

  } catch (error) {
    console.error("Erro no controller da IA:", error);
    next(error);
  }
};

// ==========================================
// EXECUTA A VALIDAÇÃO INTERDISCIPLINAR FINAL (PÓS-8 FORMULÁRIOS)
// ==========================================
export async function executarValidacaoInterdisciplinar(formularioId) {
  // 1. Busca dados do formulário e do aluno
  const { data: form, error: errF } = await supabase
    .from("formularios")
    .select("*")
    .eq("id", formularioId)
    .single();

  if (errF || !form) {
    throw new Error("Formulário não encontrado para validação final.");
  }

  const { data: aluno } = await supabase
    .from("alunos")
    .select("*")
    .eq("id", form.aluno_id)
    .maybeSingle();

  const nomeAluno = aluno ? aluno.nome_completo : "Estudante";
  const segmento = form.segmento || "Ensino Médio";

  // 2. Busca todas as mensagens dos 8 formulários
  const { data: mensagens, error: errM } = await supabase
    .from("mensagens_chat")
    .select("*")
    .eq("formulario_id", formularioId)
    .order("id", { ascending: true });

  if (errM) throw errM;

  // 3. Organiza o histórico completo por Formulário (1 a 8)
  const porFormulario = {};
  (mensagens || []).forEach(msg => {
    const num = Number(msg.aba) || 1;
    if (!porFormulario[num]) porFormulario[num] = [];
    const textoLimpo = (msg.texto || "")
      .replace(/\[MATRIZ:.*?\]|\[FIM_FORMULARIO\]|\[FIM_BLOCO\]/g, "")
      .trim();
    if (textoLimpo) {
      const autor = msg.remetente === "ia" ? "Tutor IA" : `Aluno (${nomeAluno})`;
      porFormulario[num].push(`${autor}: ${textoLimpo}`);
    }
  });

  let respostasTodosFormularios = "";
  for (let i = 1; i <= 8; i++) {
    const titulo = TITULOS_FORMULARIOS[i] || `Formulário ${i}`;
    respostasTodosFormularios += `\n=== ${titulo} ===\n`;
    if (porFormulario[i] && porFormulario[i].length > 0) {
      respostasTodosFormularios += porFormulario[i].join("\n") + "\n";
    } else {
      respostasTodosFormularios += "(Sem registros neste formulário)\n";
    }
  }

  // 4. Chama a IA com o prompt de validação interdisciplinar rigorosa (60% DH)
  const promptSistema = getPromptValidacaoFinal(segmento, nomeAluno, respostasTodosFormularios);

  const respostaObj = await chamarIA({
    promptSistema,
    mensagens: [
      {
        role: "user",
        content: "Realize agora o cruzamento interdisciplinar completo dos 8 formulários aplicando rigorosamente a regra mínima de 60% dos DHs, a proibição de inferências e a rastreabilidade (Quem, Onde e Por quê). Retorne exclusivamente o JSON solicitado."
      }
    ]
  });

  let textoBruto = (respostaObj.texto || "").trim();
  textoBruto = textoBruto.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  let resultadoValidacao;
  try {
    resultadoValidacao = JSON.parse(textoBruto);
  } catch (e) {
    console.warn("Falha ao parsear JSON puro da validação final, encapsulando texto:", e.message);
    resultadoValidacao = {
      resumo_geral: textoBruto,
      habilidades_validadas: []
    };
  }

  // 5. Persiste o resultado da validação final no banco de dados
  // Remove validações anteriores deste formulário (caso reexecutado) e insere a atualizada
  await supabase
    .from("mensagens_chat")
    .delete()
    .eq("formulario_id", formularioId)
    .eq("remetente", "validacao_final");

  await supabase.from("mensagens_chat").insert({
    formulario_id: formularioId,
    remetente: "validacao_final",
    texto: JSON.stringify(resultadoValidacao),
    habilidade_id: JSON.stringify(resultadoValidacao),
    aba: 8
  });

  // Atualiza status do formulário para concluído
  await supabase
    .from("formularios")
    .update({ status: "concluido" })
    .eq("id", formularioId);

  return resultadoValidacao;
}

export const validarFinal = async (req, res, next) => {
  try {
    const { formulario_id } = req.body;
    if (!formulario_id) {
      return res.status(400).json({ ok: false, mensagem: "formulario_id é obrigatório" });
    }

    const resultado = await executarValidacaoInterdisciplinar(formulario_id);
    res.json({ ok: true, validacao: resultado });
  } catch (error) {
    console.error("Erro na validação interdisciplinar final:", error);
    next(error);
  }
};
