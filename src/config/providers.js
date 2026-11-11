/* ============================================================
   Nova EJA - Multi-provedor de IA (Gemini Novo SDK, DeepSeek, Groq)
   ============================================================ */

import { GoogleGenAI } from "@google/genai"; // NOVO SDK
import { ENV } from "./env.js";

// ---------- GEMINI (com rotação de chaves) ----------
let geminiKeys = [];
let geminiIndex = 0;

if (ENV.GEMINI_API_KEYS) {
  geminiKeys = ENV.GEMINI_API_KEYS.split(",").map(k => k.trim()).filter(Boolean);
} else if (ENV.GEMINI_API_KEY) {
  geminiKeys = [ENV.GEMINI_API_KEY.trim()];
}

async function chamarGemini({ promptSistema, mensagens }) {
  if (geminiKeys.length === 0) throw new Error("Nenhuma chave Gemini configurada.");

  for (let i = 0; i < geminiKeys.length; i++) {
    const chaveAtual = geminiKeys[geminiIndex % geminiKeys.length];
    try {
      // Inicializa o cliente com a chave atual
      const ai = new GoogleGenAI({ apiKey: chaveAtual });
      
      // Converte o histórico para o formato do novo SDK
      const contents = mensagens.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      // Chamada no novo formato
      const response = await ai.models.generateContent({
        model: ENV.GEMINI_MODEL || "gemini-3.5-flash-lite", // Modelo atualizado
        config: { systemInstruction: promptSistema },
        contents: contents
      });

      const texto = response.text;
      geminiIndex++;
      return { texto, provedor: "gemini" };
    } catch (erro) {
      console.warn(`[ia] Falha na chave Gemini ${geminiIndex % geminiKeys.length}:`, erro.message);
      geminiIndex++;
    }
  }
  throw new Error("Todas as chaves do Gemini falharam.");
}

// ---------- DEEPSEEK (Fallback 1) ----------
async function chamarDeepSeek({ promptSistema, mensagens }) {
  if (!ENV.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY nao configurada.");

  const corpo = {
    model: ENV.DEEPSEEK_MODEL || "deepseek-chat", // Modelo padrão da API deles
    messages: [{ role: "system", content: promptSistema }, ...mensagens],
    temperature: 0.4,
    stream: false
  };

  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + ENV.DEEPSEEK_API_KEY.trim()
    },
    body: JSON.stringify(corpo)
  });

  if (!resp.ok) {
    const detalhe = await resp.text();
    throw new Error("DeepSeek " + resp.status + ": " + detalhe);
  }

  const dados = await resp.json();
  const texto = dados.choices?.[0]?.message?.content || "";
  return { texto, provedor: "deepseek" };
}

// ---------- GROQ (Fallback 2) ----------
async function chamarGroq({ promptSistema, mensagens }) {
  if (!ENV.GROQ_API_KEY) throw new Error("GROQ_API_KEY nao configurada.");

  const corpo = {
    model: ENV.GROQ_MODEL || "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: promptSistema }, ...mensagens],
    temperature: 0.4
  };

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + ENV.GROQ_API_KEY.trim()
    },
    body: JSON.stringify(corpo)
  });

  if (!resp.ok) {
    const detalhe = await resp.text();
    throw new Error("Groq " + resp.status + ": " + detalhe);
  }

  const dados = await resp.json();
  const texto = dados.choices?.[0]?.message?.content || "";
  return { texto, provedor: "groq" };
}

// ---------- API pública com Failover ----------
export async function chamarIA({ promptSistema, mensagens }) {
  // 1. Tenta o Gemini
  try {
    console.log("[ia] Tentando provedor: gemini...");
    return await chamarGemini({ promptSistema, mensagens });
  } catch (erroGemini) {
    console.warn("[ia] Gemini falhou:", erroGemini.message);

    // 2. Tenta o DeepSeek
    if (ENV.DEEPSEEK_API_KEY) {
      try {
        console.log("[ia] Tentando provedor: deepseek...");
        return await chamarDeepSeek({ promptSistema, mensagens });
      } catch (erroDeepSeek) {
        console.warn("[ia] DeepSeek falhou:", erroDeepSeek.message);
      }
    }

    // 3. Tenta o Groq
    if (ENV.GROQ_API_KEY) {
      try {
        console.log("[ia] Tentando provedor: groq...");
        return await chamarGroq({ promptSistema, mensagens });
      } catch (erroGroq) {
        console.warn("[ia] Groq falhou:", erroGroq.message);
      }
    }

    throw new Error("Todos os provedores de IA falharam.");
  }
}