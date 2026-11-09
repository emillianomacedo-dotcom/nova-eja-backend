import { chamarIA } from "../config/providers.js";
import { getPromptSistema } from "../services/prompts.js";

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
// FUNÇÃO 2: CHAT
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

    // Chama a função que monta o prompt com a Matriz SESI correta
    const promptSistema = getPromptSistema(segmento, aba);

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