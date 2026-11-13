import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { MATRIZ_FUNDAMENTAL, MATRIZ_MEDIO } from "../services/prompts.js";
import PDFDocument from "pdfkit";
import fs from "fs"; // Para ler a imagem da logo
import path from "path";

const router = Router();

// 1. Listar todos os alunos
router.get("/alunos", async (req, res, next) => {
  try {
    const { data: alunos, error: errA } = await supabase
      .from("alunos")
      .select("*")
      .order("nome_completo");

    if (errA) throw errA;

    const { data: formularios, error: errF } = await supabase
      .from("formularios")
      .select("aluno_id, turma, segmento, id")
      .order("id", { ascending: false });

    if (errF) throw errF;

    const alunosFormatados = alunos.map(aluno => {
      const formDoAluno = formularios.find(f => f.aluno_id === aluno.id);
      return {
        id: aluno.id,
        nome_completo: aluno.nome_completo,
        cpf: aluno.cpf,
        acesso_bloqueado: aluno.acesso_bloqueado,
        turma: formDoAluno ? formDoAluno.turma : "Sem turma",
        segmento: formDoAluno ? formDoAluno.segmento : "Não informado"
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

// 3. Buscar relatório (JSON)
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
    if (!form) return res.json({ ok: true, mensagens: [], formulario: null, matriz: null });

    const { data: mensagens, error: errM } = await supabase
      .from("mensagens_chat")
      .select("*")
      .eq("formulario_id", form.id)
      .order("id");
      
    if (errM) throw errM;

    const isMedio = form.segmento && form.segmento.toLowerCase().includes("médio");
    const matriz = isMedio ? MATRIZ_MEDIO : MATRIZ_FUNDAMENTAL;

    res.json({ ok: true, mensagens: mensagens || [], formulario: form, matriz: matriz });
  } catch (e) { next(e); }
});

// 4. Gerar PDF (Capa sem azul, logomarca e conteúdo centralizado)
router.get("/alunos/:id/relatorio.pdf", async (req, res, next) => {
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
    if (!form) return res.status(404).json({ ok: false, mensagem: "Formulário não encontrado" });

    const { data: mensagens, error: errM } = await supabase
      .from("mensagens_chat")
      .select("*")
      .eq("formulario_id", form.id)
      .order("id");
      
    if (errM) throw errM;

    const { data: aluno, error: errA } = await supabase
      .from("alunos")
      .select("*")
      .eq("id", form.aluno_id)
      .single();
      
    if (errA) throw errA;

    const isMedio = form.segmento && form.segmento.toLowerCase().includes("médio");
    const matrizCompleta = isMedio ? MATRIZ_MEDIO : MATRIZ_FUNDAMENTAL;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Relatorio_RDS_${aluno.nome_completo.replace(/\s+/g, '_')}.pdf`);
    
    doc.pipe(res);

    // --- CAPA (SEM AZUL, LOGO NO TOPO, INFORMAÇÕES CENTRALIZADAS) ---
    
    // Caminho da logo (ajuste se necessário)
    const logoPath = path.join(process.cwd(), "icons", "logo-sesi.png");
    
    // Desenha a logo no topo (centralizada)
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width / 2 - 50, 50, { width: 100 });
      doc.moveDown(5); // Espaço após a logo
    } else {
      doc.fontSize(10).text("[Logo SESI não encontrada]", { align: 'center' });
      doc.moveDown(2);
    }

    // Informações centrais da capa
    doc.fontSize(16).fillColor('black').text('SESI - SERVIÇO SOCIAL DA INDÚSTRIA', { align: 'center' });
    doc.fontSize(12).text('Departamento Regional da Paraíba', { align: 'center' });
    doc.fontSize(12).text('Gerência de Educação', { align: 'center' });
    doc.fontSize(12).text('Unidade: Escola SESI Prata', { align: 'center' });
    doc.moveDown(2);
    
    doc.fontSize(24).fillColor('black').text('Relatório RDS', { align: 'center' });
    doc.fontSize(18).text('Reconhecimento de Saberes', { align: 'center' });
    doc.moveDown(2);
    
    doc.fontSize(14).text(aluno.nome_completo, { align: 'center' });
    doc.fontSize(12).text(`CPF: ${aluno.cpf}`, { align: 'center' });
    doc.fontSize(12).text(`Etapa: ${form.segmento}`, { align: 'center' });
    doc.fontSize(12).text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });
    
    doc.moveDown(4); // Espaço antes do rodapé
    
    // Rodapé da capa
    doc.fontSize(10).fillColor('#555').text('SESI · Nova EJA · Reconhecimento de Saberes · v2.0', { align: 'center' });
    doc.fontSize(8).text('Desenvolvido por Emilliano Gabriel Macêdo - Pedagogo / Supervisor Pedagógico', { align: 'center' });

    // Quebra de página para o conteúdo
    doc.addPage();

    // --- CONTEÚDO (Fonte 10) ---
    doc.fillColor('black').fontSize(10).text('Relatório de Reconhecimento', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Nome: ${aluno.nome_completo}`);
    doc.text(`CPF: ${aluno.cpf}`);
    doc.text(`Etapa: ${form.segmento}`);
    doc.text(`Status: Concluído`);
    doc.moveDown();

    // Habilidades Reconhecidas pela IA (Fonte 10)
    const habilidadesMap = new Map();
    mensagens.forEach(msg => {
      if (msg.habilidade_id) {
        try {
          const hab = JSON.parse(msg.habilidade_id);
          if (hab && hab.area) {
            const codigoHab = hab.habilidade || hab.codigo || "Habilidade Identificada";
            const chave = `${hab.area}-${codigoHab}`;
            if (!habilidadesMap.has(chave)) {
              habilidadesMap.set(chave, { area: hab.area, codigo: codigoHab, justificativa: hab.justificativa || "Reconhecida." });
            }
          }
        } catch (e) {}
      }
    });

    const habilidades = Array.from(habilidadesMap.values());
    if (habilidades.length > 0) {
      doc.fontSize(10).text('Habilidades Reconhecidas pela IA:', { underline: true });
      doc.moveDown(0.5);
      habilidades.forEach(h => {
        doc.fontSize(10).text(`Área: ${h.area} | Habilidade: ${h.codigo}`);
        doc.fontSize(10).fillColor('#555').text(`Justificativa: ${h.justificativa}`);
        doc.moveDown(0.5);
      });
      doc.fillColor('black');
    }

    doc.addPage();

    // --- RELATOS POR BLOCO (Fonte 10 e Checkboxes) ---
    doc.fontSize(10).text('Relatos de Experiência por Bloco:', { underline: true });
    doc.moveDown();

    const blocos = {};
    mensagens.forEach(msg => {
      if (!blocos[msg.aba]) blocos[msg.aba] = [];
      blocos[msg.aba].push(msg);
    });

    const titulosBlocos = {
      1: "1. História de Vida", 2: "2. Tempo Livre", 3: "3. Atividades Sociais",
      4: "4. Experiência Profissional", 5: "5. Linguagens", 6: "6. Matemática",
      7: "7. Ciências da Natureza", 8: "8. Ciências Humanas"
    };

    // Função para extrair competências e habilidades da matriz
    const extrairCompetenciasEHabilidades = (matriz, area) => {
      const matrizNormalizada = matriz.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const regexArea = new RegExp(`(?:\\[${area}\\]|${area}\\s*\\n)([\\s\\S]*?)(?=\\[|$)`, 'i');
      const match = matrizNormalizada.match(regexArea);
      if (!match) return [];

      const linhas = match[1].split('\n').map(l => l.trim()).filter(l => l);
      const competencias = [];
      let competenciaAtual = null;

      linhas.forEach(linha => {
        if (linha.startsWith('C')) {
          competenciaAtual = { titulo: linha, habilidades: [] };
          competencias.push(competenciaAtual);
        } else if (linha.startsWith('H') && competenciaAtual) {
          competenciaAtual.habilidades.push(linha);
        }
      });

      return competencias;
    };

    for (let i = 1; i <= 8; i++) {
      if (blocos[i] && blocos[i].length > 0) {
        doc.fontSize(10).text(titulosBlocos[i], { underline: true });
        doc.moveDown(0.5);

        // Relatos (Fonte 10)
        let ultimaPerguntaIA = "";
        blocos[i].forEach(msg => {
          const textoLimpo = msg.texto.replace(/\[MATRIZ:.*?\]|\[FIM_BLOCO\]/g, "").trim();
          if (msg.remetente === 'ia') {
            ultimaPerguntaIA = textoLimpo;
          } else if (msg.remetente === 'aluno' && textoLimpo) {
            if (ultimaPerguntaIA) {
              doc.fontSize(10).fillColor('#0057b8').text(`Tutor IA: ${ultimaPerguntaIA}`);
            }
            doc.fontSize(10).fillColor('black').text(`Aluno: ${textoLimpo}`);
            doc.moveDown(0.5);
            ultimaPerguntaIA = "";
          }
        });
        doc.moveDown();

        // Checkboxes para blocos 5 a 8
        if (i >= 5) {
          doc.fontSize(10).text('Validação do Professor:', { underline: true });
          doc.moveDown(0.5);

          let areaNome = "";
          if (i === 5) areaNome = "LINGUAGENS";
          else if (i === 6) areaNome = "MATEMÁTICA";
          else if (i === 7) areaNome = "CIÊNCIAS DA NATUREZA";
          else if (i === 8) areaNome = "CIÊNCIAS HUMANAS";

          const competencias = extrairCompetenciasEHabilidades(matrizCompleta, areaNome);

          if (competencias.length > 0) {
            competencias.forEach(comp => {
              doc.fontSize(10).text(comp.titulo, { underline: true });
              doc.moveDown(0.3);
              
              comp.habilidades.forEach(hab => {
                const checkboxX = 50;
                const checkboxY = doc.y;
                
                doc.rect(checkboxX, checkboxY, 10, 10).stroke();
                doc.fontSize(10).text(`  ${hab}`, checkboxX + 15, checkboxY - 2, { width: 500 });
                doc.moveDown(0.8);
              });
              doc.moveDown(0.5);
            });
          } else {
            doc.fontSize(10).text('[ ] Nenhuma competência/habilidade encontrada na matriz para esta área.');
          }
          doc.moveDown();
        }
      }
    }

    doc.end();

  } catch (e) { next(e); }
});

// 5. Deletar aluno
router.delete("/alunos/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: formularios } = await supabase.from("formularios").select("id").eq("aluno_id", id);
    if (formularios && formularios.length > 0) {
      const idsFormularios = formularios.map(f => f.id);
      await supabase.from("mensagens_chat").delete().in("formulario_id", idsFormularios);
    }
    await supabase.from("formularios").delete().eq("aluno_id", id);
    const { error } = await supabase.from("alunos").delete().eq("id", id);
    if (error) throw error;
    res.json({ ok: true, mensagem: "Aluno e registros deletados com sucesso." });
  } catch (e) { next(e); }
});

export default router;