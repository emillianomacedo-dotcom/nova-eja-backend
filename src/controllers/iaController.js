import { supabase } from "../config/supabase.js";
// IMPORTANTE: Mantenha aqui o import que você já usava para chamar a IA (Gemini/Groq).
// Abaixo está o exemplo padrão. Se o seu era diferente, ajuste apenas esta linha.
import { getAIResponse } from "../config/providers.js"; 

// ==========================================
// FUNÇÃO 1: ANALISAR (Usada pelo frontend para checar a IA antes de salvar)
// ==========================================
export const analisar = async (req, res, next) => {
  try {
    const { texto, segmento } = req.body;
    if (!texto) return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });

    // Chama a IA (ajuste o formato da chamada conforme o seu projeto)
    const respostaIA = await getAIResponse({
      prompt: texto,
      historico: [],
      segmento: segmento
    });

    res.json({ ok: true, resposta: respostaIA });
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

    // 1. Chama a IA
    const respostaIA = await getAIResponse({
      prompt: texto,
      historico: historico,
      aba: aba,
      segmento: segmento
    });

    // 2. Extrai a tag [MATRIZ: {...}] da resposta
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

    // 3. Retorna a resposta e a habilidade completa
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
