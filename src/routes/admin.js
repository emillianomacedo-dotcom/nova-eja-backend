import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { MATRIZ_FUNDAMENTAL, MATRIZ_MEDIO } from "../services/prompts.js";
import { executarValidacaoInterdisciplinar } from "../controllers/iaController.js";
import PDFDocument from "pdfkit";
import fs from "fs";
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

    const mensagensFiltradas = (mensagens || []).filter(
      m => m.remetente !== "auditoria_camera" && m.remetente !== "sistema_auditoria"
    );

    res.json({ ok: true, mensagens: mensagensFiltradas, formulario: form, matriz: matriz });
  } catch (e) { next(e); }
});

// 3.1 Buscar capturas de autenticidade (câmera autorizada pelo aluno)
router.get("/alunos/:id/auditoria", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: form, error: errF } = await supabase
      .from("formularios")
      .select("id")
      .eq("aluno_id", id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errF) throw errF;
    if (!form) return res.json({ ok: true, capturas: [] });

    const { data: registros, error: errM } = await supabase
      .from("mensagens_chat")
      .select("*")
      .eq("formulario_id", form.id)
      .in("remetente", ["auditoria_camera", "sistema_auditoria"])
      .order("id");

    if (errM) throw errM;

    const capturas = (registros || []).map(r => {
      if (r.remetente === "sistema_auditoria") {
        return { id: r.id, aba: r.aba, tipo: "aviso", detalhe: r.texto };
      }
      try {
        const parsed = JSON.parse(r.texto);
        return {
          id: r.id,
          aba: r.aba,
          tipo: "foto",
          motivo: parsed.motivo,
          data_hora: parsed.data_hora,
          imagem: parsed.imagem
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    res.json({ ok: true, capturas });
  } catch (e) { next(e); }
});

// 4. Gerar PDF (Capa + Validação Interdisciplinar + Relatos + Checkboxes + Snapshots de Autenticidade)
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

    const mensagensConversa = (mensagens || []).filter(
      m => m.remetente === "ia" || m.remetente === "aluno"
    );
    const registroValidacao = (mensagens || []).find(m => m.remetente === "validacao_final");
    let validacaoFinal = null;

    if (registroValidacao) {
      try {
        validacaoFinal = JSON.parse(registroValidacao.texto);
      } catch (e) {}
    } else if (mensagensConversa.length > 0) {
      try {
        validacaoFinal = await executarValidacaoInterdisciplinar(form.id);
      } catch (e) {
        console.warn("Aviso ao executar validação final sob demanda para o PDF:", e.message);
      }
    }

    const isMedio = form.segmento && form.segmento.toLowerCase().includes("médio");
    const matrizCompleta = isMedio ? MATRIZ_MEDIO : MATRIZ_FUNDAMENTAL;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Relatorio_RDS_${aluno.nome_completo.replace(/\s+/g, '_')}.pdf`);

    doc.pipe(res);

    // --- CAPA ---
    const logoPath = path.join(process.cwd(), "icons", "logo-sesi.png");
    const logoTop = 50;
    const logoWidth = 120;
    const logoX = (doc.page.width - logoWidth) / 2;

    if (fs.existsSync(logoPath)) {
      const img = doc.openImage(logoPath);
      const logoHeight = (img.height / img.width) * logoWidth;
      doc.image(logoPath, logoX, logoTop, { width: logoWidth });
      doc.y = logoTop + logoHeight + 20;
    } else {
      doc.fontSize(10).text("[Logo SESI não encontrada]", { align: 'center' });
      doc.moveDown(2);
    }

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

    doc.moveDown(4);

    doc.fontSize(10).fillColor('#555').text('SESI · Nova EJA · Reconhecimento de Saberes · v3.0', { align: 'center' });
    doc.fontSize(8).text('Desenvolvido por Emilliano Gabriel Macêdo - Pedagogo / Supervisor Pedagógico', { align: 'center' });

    doc.addPage();

    // --- PÁGINA 2: PARECER INTERDISCIPLINAR FINAL (REGRA DOS 60% DE DH) ---
    doc.fillColor('black').fontSize(12).text('Relatório de Reconhecimento de Saberes', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Nome: ${aluno.nome_completo}`);
    doc.text(`CPF: ${aluno.cpf}`);
    doc.text(`Turma: ${form.turma || "Não informada"}`);
    doc.text(`Etapa: ${form.segmento}`);
    doc.text(`Status: ${form.status === "concluido" ? "Concluído" : "Em andamento"}`);
    doc.moveDown();

    doc.fontSize(11).fillColor('#0057b8').text('Validação Interdisciplinar Final (Critério Mínimo: 60% dos DHs):', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('black');

    if (validacaoFinal) {
      if (validacaoFinal.resumo_geral) {
        doc.fontSize(10).text(`Parecer Técnico: ${validacaoFinal.resumo_geral}`);
        doc.moveDown();
      }

      const habsValidadas = Array.isArray(validacaoFinal.habilidades_validadas)
        ? validacaoFinal.habilidades_validadas
        : [];

      if (habsValidadas.length > 0) {
        habsValidadas.forEach((h, idx) => {
          doc.fontSize(10).fillColor('#0057b8').text(
            `${idx + 1}. Área: ${h.area} | Habilidade: ${h.codigo}${h.descricao_habilidade ? ` – ${h.descricao_habilidade}` : ""}`
          );
          doc.fillColor('black').fontSize(9.5);
          if (h.dhs_atingidos || h.percentual_dh) {
            const listaDH = Array.isArray(h.dhs_atingidos) ? h.dhs_atingidos.join(", ") : (h.dhs_atingidos || "");
            doc.text(`• DHs Comprovados: ${listaDH} ${h.percentual_dh ? `(${h.percentual_dh})` : ""}`);
          }
          doc.text(`• Quem: ${h.quem || aluno.nome_completo}`);
          doc.text(`• Onde (Evidência Literal): ${h.onde || "Não especificado"}`);
          doc.text(`• Por quê (Justificativa Técnica): ${h.porque || "Não especificado"}`);
          doc.moveDown(0.7);
        });
      } else {
        doc.fontSize(10).fillColor('#555').text(
          'Nenhuma habilidade atingiu o critério mínimo obrigatório de 60% dos Detalhamentos de Habilidade (DH) com evidência textual explícita nos 8 formulários.'
        );
        doc.fillColor('black');
      }
    } else {
      doc.fontSize(10).fillColor('#555').text('Validação final ainda não processada.');
      doc.fillColor('black');
    }

    doc.addPage();

    // --- RELATOS POR FORMULÁRIO (Fonte 10 e Checkboxes) ---
    doc.fontSize(11).fillColor('#0057b8').text('Relatos de Experiência por Formulário:', { underline: true });
    doc.fillColor('black');
    doc.moveDown();

    const formulariosAgrupados = {};
    (mensagens || []).forEach(msg => {
      if (
        msg.remetente === "validacao_final" ||
        msg.remetente === "auditoria_camera" ||
        msg.remetente === "sistema_auditoria"
      ) return;
      if (!formulariosAgrupados[msg.aba]) formulariosAgrupados[msg.aba] = [];
      formulariosAgrupados[msg.aba].push(msg);
    });

    const titulosFormularios = {
      1: "Formulário 1: História de Vida",
      2: "Formulário 2: Tempo Livre",
      3: "Formulário 3: Atividades Sociais",
      4: "Formulário 4: Experiência Profissional",
      5: "Formulário 5: Linguagens",
      6: "Formulário 6: Matemática",
      7: "Formulário 7: Ciências da Natureza",
      8: "Formulário 8: Ciências Humanas"
    };

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
      if (formulariosAgrupados[i] && formulariosAgrupados[i].length > 0) {
        doc.fontSize(10).fillColor('#0057b8').text(titulosFormularios[i], { underline: true });
        doc.fillColor('black');
        doc.moveDown(0.5);

        let ultimaPerguntaIA = "";
        formulariosAgrupados[i].forEach(msg => {
          const textoLimpo = msg.texto.replace(/\[MATRIZ:.*?\]|\[FIM_FORMULARIO\]|\[FIM_BLOCO\]/g, "").trim();
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
            const matrizNormalizada = matrizCompleta.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const regexArea = new RegExp(`(?:\\[${areaNome}\\]|${areaNome}\\s*\\n)([\\s\\S]*?)(?=\\[|$)`, 'i');
            const match = matrizNormalizada.match(regexArea);

            if (match) {
              const linhas = match[1].split('\n').map(l => l.trim()).filter(l => l.startsWith('H'));
              if (linhas.length > 0) {
                linhas.forEach(hab => {
                  const checkboxX = 50;
                  const checkboxY = doc.y;

                  doc.rect(checkboxX, checkboxY, 10, 10).stroke();
                  doc.fontSize(10).text(`  ${hab}`, checkboxX + 15, checkboxY - 2, { width: 500 });
                  doc.moveDown(0.8);
                });
              } else {
                doc.fontSize(10).text('[ ] Nenhuma habilidade encontrada na matriz para esta área.');
              }
            } else {
              doc.fontSize(10).text('[ ] Nenhuma competência/habilidade encontrada na matriz para esta área.');
            }
          }
          doc.moveDown();
        }
      }
    }

    // --- ÚLTIMA SEÇÃO: REGISTRO DE AUTENTICIDADE (SNAPSHOTS POR FORMULÁRIO) ---
    const registrosCamera = (mensagens || []).filter(
      m => m.remetente === "auditoria_camera" || m.remetente === "sistema_auditoria"
    );

    doc.addPage();
    doc.fontSize(12).fillColor('#0057b8').text('Registro de Autenticidade e Identificação do Estudante (LGPD)', { underline: true });
    doc.moveDown(0.4);
    doc.fillColor('black').fontSize(9.5);
    doc.text(`Estudante Identificado: ${aluno.nome_completo} | CPF: ${aluno.cpf}`);
    doc.text(`Turma: ${form.turma || "Não informada"} | Etapa: ${form.segmento}`);
    doc.moveDown(0.8);

    const fotosValidas = [];
    let avisoRecusa = null;

    registrosCamera.forEach(reg => {
      if (reg.remetente === "sistema_auditoria") {
        avisoRecusa = reg.texto;
        return;
      }
      try {
        const parsed = JSON.parse(reg.texto);
        if (parsed && parsed.imagem) {
          fotosValidas.push({
            aba: Number(reg.aba) || 1,
            motivo: parsed.motivo || "inicio_formulario",
            data_hora: parsed.data_hora || null,
            imagem: parsed.imagem
          });
        }
      } catch (e) {}
    });

    if (fotosValidas.length > 0) {
      doc.fontSize(9).fillColor('#475569').text(
        'Capturas fotográficas autorizadas pelo estudante a cada início/mudança de formulário para comprovação de autoria:'
      );
      doc.moveDown(1);

      const larguraCard = 235;
      const alturaImagem = 155;
      const alturaCardTotal = 215;
      const margemEsquerda = 50;
      const espacoColunas = 25;

      let coluna = 0;
      let yLinhaAtual = doc.y;

      fotosValidas.forEach((foto) => {
        // Quebra de página caso não caiba a próxima linha de cards
        if (yLinhaAtual + alturaCardTotal > doc.page.height - 60) {
          doc.addPage();
          yLinhaAtual = 50;
          coluna = 0;
        }

        const xCard = margemEsquerda + coluna * (larguraCard + espacoColunas);

        // Moldura discreta do card
        doc.rect(xCard, yLinhaAtual, larguraCard, alturaCardTotal)
          .lineWidth(0.7)
          .strokeColor('#cbd5e1')
          .stroke();

        // Converte DataURL Base64 para Buffer JPEG e desenha no PDF
        try {
          const base64Limpo = foto.imagem.replace(/^data:image\/\w+;base64,/, "");
          const imgBuffer = Buffer.from(base64Limpo, "base64");
          doc.image(imgBuffer, xCard + 10, yLinhaAtual + 8, {
            fit: [larguraCard - 20, alturaImagem],
            align: 'center',
            valign: 'center'
          });
        } catch (errImg) {
          doc.fontSize(8.5).fillColor('#c0392b').text(
            '[Imagem indisponível]',
            xCard + 10,
            yLinhaAtual + 70,
            { width: larguraCard - 20, align: 'center' }
          );
        }

        // Legenda identificando o formulário, aluno e horário
        const tituloForm = titulosFormularios[foto.aba] || `Formulário ${foto.aba}`;
        const dataFormatada = foto.data_hora
          ? new Date(foto.data_hora).toLocaleString('pt-BR', { timeZone: 'America/Recife' })
          : "Horário não registrado";

        const yTexto = yLinhaAtual + alturaImagem + 14;
        doc.fontSize(8.5).fillColor('#0057b8').text(
          tituloForm,
          xCard + 10,
          yTexto,
          { width: larguraCard - 20, ellipsis: true }
        );
        doc.fontSize(8).fillColor('black').text(
          `Aluno: ${aluno.nome_completo}`,
          xCard + 10,
          yTexto + 12,
          { width: larguraCard - 20, ellipsis: true }
        );
        doc.fontSize(7.5).fillColor('#555').text(
          `Registro: ${dataFormatada}`,
          xCard + 10,
          yTexto + 23,
          { width: larguraCard - 20, ellipsis: true }
        );

        coluna++;
        if (coluna >= 2) {
          coluna = 0;
          yLinhaAtual += alturaCardTotal + 16;
        }
      });

      // Atualiza cursor Y ao final da grade
      doc.y = coluna === 0 ? yLinhaAtual : yLinhaAtual + alturaCardTotal + 16;
    } else {
      doc.fontSize(10).fillColor('#555').text(
        avisoRecusa
          ? `Registro do sistema: ${avisoRecusa}`
          : 'Nenhuma captura fotográfica de câmera foi registrada durante esta sessão (câmera não autorizada ou dispositivo sem câmera).'
      );
      doc.fillColor('black');
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