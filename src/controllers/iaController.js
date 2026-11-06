import { supabase } from "../config/supabase.js";
import { getAIResponse } from "../config/providers.js"; // ou de onde você importa a função de IA
import { PROMPTS_GERAIS } from "../services/prompts.js"; // Ajuste o nome do import conforme seu projeto

export const chatIA = async (req, res, next) => {
  try {
    const { texto, historico, aba, segmento } = req.body;

    if (!texto) {
      return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });
    }

    // 1. Monta o prompt com as instruções do sistema + histórico
    // (Assume-se que a função getAIResponse já lida com o fallback Gemini/Groq)
    const respostaIA = await getAIResponse({
      prompt: texto,
      historico: historico,
      aba: aba,
      segmento: segmento
    });

    // 2. Extrai a tag [MATRIZ: {...}] da resposta da IA
    // A regex procura a tag e captura o JSON dentro dela
    const matchMatriz = respostaIA.match(/\[MATRIZ:\s*(\{.*?\})\]/s);
    let habilidadeSalvar = null;

    if (matchMatriz) {
      try {
        // Pega o JSON que a IA gerou e transforma em texto para salvar no banco
        const dadosMatriz = JSON.parse(matchMatriz[1]);
        habilidadeSalvar = JSON.stringify(dadosMatriz); 
      } catch (e) {
        console.error("Erro ao ler a matriz JSON da IA:", e);
      }
    }

    // 3. Retorna a resposta para o frontend (o frontend também vai salvar, mas o ideal é salvar aqui)
    res.json({
      ok: true,
      resposta: respostaIA,
      habilidade_id: habilidadeSalvar // Retorna o JSON completo para o frontend
    });

  } catch (error) {
    console.error("Erro no controller da IA:", error);
    next(error);
  }
};
