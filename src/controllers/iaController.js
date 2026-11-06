import { supabase } from "../config/supabase.js";
// IMPORTANTE: Se o seu código original importava a função da IA daqui, mantenha a linha correta.
// Como eu não tenho o arquivo original, deixei sem o import da IA para não quebrar.
// A função getAIResponse deve ser a que você já usava antes.

export const chatIA = async (req, res, next) => {
  try {
    const { texto, historico, aba, segmento } = req.body;

    if (!texto) {
      return res.status(400).json({ ok: false, mensagem: "Texto e obrigatorio" });
    }

    // =========================================================================
    // ATENÇÃO: Substitua a linha abaixo pela chamada real da sua IA.
    // Provavelmente você tinha algo como: const respostaIA = await chamarGemini(...)
    // ou const respostaIA = await getAIResponse(...)
    // =========================================================================
    const respostaIA = await getAIResponse({
      prompt: texto,
      historico: historico,
      aba: aba,
      segmento: segmento
    });

    // 2. Extrai a tag [MATRIZ: {...}] da resposta da IA
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

    // 3. Retorna a resposta para o frontend
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
