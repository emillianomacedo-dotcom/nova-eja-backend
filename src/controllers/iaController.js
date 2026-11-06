import { chamarIA } from "../config/providers.js";

// ==========================================
// FUNÇÃO 1: ANALISAR (Chamada direta pelo frontend se necessário)
// ==========================================
export const analisar = async (req, res, next) => {
  try {
    const { texto, segmento } = req.body;
    if (!texto) return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });

    // Chama a IA usando o formato do seu providers.js
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
// FUNÇÃO 2: CHAT (Usada na conversa normal do aluno)
// ==========================================
export const chat = async (req, res, next) => {
  try {
    const { texto, historico, aba, segmento } = req.body;

    if (!texto) {
      return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });
    }

    // 1. Monta o histórico e o prompt do sistema
    const mensagens = (historico || []).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Se o histórico veio vazio, ele usa o texto atual
    if (mensagens.length === 0) {
      mensagens.push({ role: "user", content: texto });
    }

    // 2. Chama a IA através do seu providers.js
    const respostaObj = await chamarIA({
      promptSistema: `Você é o Tutor IA da Nova EJA (Reconhecimento de Saberes do SESI). O aluno está no Bloco ${aba}. O segmento é ${segmento}. Conduza a conversa com acolhimento e extraia habilidades usando a tag [MATRIZ: {"area": "...", "habilidade": "...", "justificativa": "..."}].`,
      mensagens: mensagens
    });

    const respostaIA = respostaObj.texto;

    // 3. Extrai a tag [MATRIZ: {...}] da resposta da IA
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

    // 4. Retorna a resposta e a habilidade completa
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
