/* ============================================================
   Nova EJA - Configuração de Variáveis de Ambiente
   ============================================================ */

import dotenv from "dotenv";

// Tenta carregar o .env (se existir). Se não existir, não quebra.
dotenv.config();

// Valida se uma variável existe, senão lança erro (útil para o Render)
function obrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variavel de ambiente obrigatoria ausente: ${nome}`);
  return valor;
}

export const ENV = {
  // ---------- SERVIDOR ----------
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  CORS_ORIGINS: process.env.CORS_ORIGINS || "*",

  // ---------- SUPABASE ----------
  SUPABASE_URL: obrigatoria("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: obrigatoria("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",

  // ---------- IA: GEMINI ----------
  GEMINI_API_KEYS: process.env.GEMINI_API_KEYS || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",

  // ---------- IA: DEEPSEEK ----------
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-flash",
  
  // ---------- IA: GROQ ----------
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GROQ_MODEL: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",

  // ---------- IA: OPENAI (Opcional) ----------
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",

  // ---------- OUTROS ----------
  JWT_SECRET: process.env.JWT_SECRET || "nova-eja-secret",
};