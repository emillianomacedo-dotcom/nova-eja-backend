import { conversar } from "../services/gemini.js";

export async function gerarRelatorio(req, res, next) {
  try {
    const { mensagens, aluno } = req.body;

    if (!mensagens || !Array.isArray(mensagens)) {
      return res.status(400).json({ ok: false, mensagem: "Mensagens invalidas" });
    }

    const falasAluno = mensagens.filter(m => m.remetente === "aluno").map(m => m.texto);
    if (falasAluno.length === 0) {
      return res.json({ ok: true, relatorio: "Nenhuma fala do aluno registrada." });
    }

    const textoAluno = falasAluno.join("\n\n");

    const prompt = `
Você é um avaliador pedagógico do SESI. Abaixo estão as respostas de um aluno.
Sua tarefa é:
1. Agrupar as respostas em formato de relatório, usando os títulos oficiais dos Formulários (Formulário 1 a Formulário 8).
2. Identificar quais HABILIDADES ESPECÍFICAS da Matriz SESI o aluno demonstrou (ex: "H1 - Identificar formas...", "H4 - Descrever..."), exigindo evidência explícita de pelo menos 60% dos Detalhamentos de Habilidade (DH).

RESPOSTAS DO ALUNO:
${textoAluno}

INSTRUÇÕES DO RELATÓRIO:
- Organize em tópicos: "Formulário 1: História da Minha Vida", etc.
- No final, crie uma seção "HABILIDADES RECONHECIDAS" listando Quem, Onde (Formulário e trecho literal) e Por quê (DHs atingidos).
- Seja rigoroso: não faça inferências sobre relatos rasos.
`;

    const r = await conversar({ 
      aba: 1, 
      textoAluno: prompt, 
      segmento: aluno.segmento, 
      historico: [] 
    });

    res.json({ ok: true, relatorio: r.texto });
  } catch (e) { next(e); }
}
