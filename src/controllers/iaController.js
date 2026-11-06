import { chamarIA } from "../config/providers.js";

// ==========================================
// FUNÇÃO 1: ANALISAR
// ==========================================
export const analisar = async (req, res, next) => {
  try {
    const { texto, segmento } = req.body;
    if (!texto) return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });

    const respostaObj = await chamarIA({
      promptSistema: `Você é o Tutor IA da Nova EJA. Analise o texto e responda de forma breve.`,
      mensagens: [{ role: "user", content: texto }]
    });

    res.json({ ok: true, resposta: respostaObj.texto });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// FUNÇÃO 2: CHAT (Conversa com o aluno)
// ==========================================
export const chat = async (req, res, next) => {
  try {
    const { texto, historico, aba, segmento } = req.body;

    if (!texto) {
      return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });
    }

    const mensagens = (historico || []).map(m => ({
      role: m.role,
      content: m.content
    }));

    if (mensagens.length === 0) {
      mensagens.push({ role: "user", content: texto });
    }

    // O PROMPT BLINDADO: Regras rígidas para a IA não avançar de bloco sozinha
    const promptSistema = `
      Você é o Tutor IA da Nova EJA (Reconhecimento de Saberes do SESI). 
      O aluno está no Bloco ${aba} (de um total de 8 blocos). O segmento dele é: ${segmento}.
      
      REGRAS CRÍTICAS DE CONDUÇÃO (SIGA À RISCA):
      1. ACOLHIMENTO: Seja sempre muito educado, empático e acolhedor. Use uma linguagem simples (adequada para o público da EJA).
      2. APROFUNDAMENTO: NUNCA aceite respostas curtas. Se o aluno responder apenas uma frase, faça novas perguntas abertas para ele contar mais detalhes ("Como foi isso?", "Pode me contar mais sobre essa parte?").
      3. TEMPO NO BLOCO: Você deve fazer, no mínimo, de 4 a 6 interações com o aluno neste bloco antes de pensar em encerrá-lo.
      4. PROIBIÇÃO: É ESTRITAMENTE PROIBIDO emitir a tag [FIM_BLOCO] nas primeiras respostas. A tag [FIM_BLOCO] SÓ pode ser emitida se o aluno disser textualmente que "não tem mais nada a acrescentar", "é só isso" ou "acabou".
      5. EXTRAÇÃO: Sempre que o aluno relatar algo que se encaixe nas competências da Matriz SESI, emita no final do seu texto a tag [MATRIZ: {"area": "...", "habilidade": "...", "justificativa": "detalhe exato do que o aluno falou que comprova a habilidade"}].
    `;

    const respostaObj = await chamarIA({
      promptSistema: promptSistema,
      mensagens: mensagens
    });

    const respostaIA = respostaObj.texto;

    // Extrai a tag [MATRIZ: {...}] da resposta da IA
    const matchMatriz = respostaIA.match(/\[MATRIZ:\s*(\{.*?\})\]/s);
    let habilidadeSalvar = null;

    if (matchMatriz) {
      try {
        const dadosMatriz = JSON.parse(matchMatriz[1]);
        habilidadeSalvar = JSON.stringify(dadosMatriz); 
      } catch (e) {
        console.error("Erro ao ler a matriz JSON da IA:", e);
      }
    }

    res.json({
      ok: true,
      resposta: respostaIA,
      habilidade_id: habilidadeSalvar 
    });

  } catch (error) {
    console.error("Erro no controller da IA:", error);
    next(error);
  }
};
