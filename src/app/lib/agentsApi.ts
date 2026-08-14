// Camada de integração entre a nova interface (tipo `Agent`, em src/app/App.tsx)
// e o backend real do projeto (tabela `agents` no Supabase + função serverless
// /api/llm, ambas já usadas pela versão anterior da UI em ../../../App.tsx e
// em ../../../api/chat.ts).
//
// A UI nova usa um formato de agente diferente do formato salvo no banco
// (campos em português, aninhados), então este arquivo é o "tradutor" entre
// os dois lados. Mantido em um único lugar para facilitar ajustes caso o
// schema real do Supabase tenha nomes de coluna diferentes dos aqui inferidos
// a partir de api/chat.ts.

import { supabase } from "../../../lib/supabase";
import type { Agent, AttachedDoc } from "../App";
import { fetchGlobalAssets } from "./globalAssetsApi";

// Remove caracteres nulos e de controle que o Postgres não aceita em campos JSONB/Text.
const CONTROL_CHARS_RE = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(8) +
  String.fromCharCode(11) + String.fromCharCode(12) +
  String.fromCharCode(14) + "-" + String.fromCharCode(31) +
  String.fromCharCode(127) + "-" + String.fromCharCode(159) + "]",
  "g"
);
function sanitizeForPostgres(str: string): string {
  if (!str) return "";
  return str.replace(CONTROL_CHARS_RE, "");
}

// Resolve o provedor, o id real do modelo e a chave de API a partir do nome
// selecionado na aba "Modelos de IA". Não há modelos padrão do sistema — só
// existem os modelos customizados cadastrados pelo usuário (ver api/llm.ts
// callGemini/callOpenAI), cada um já com seu provedor e sua própria chave.
function resolveModel(agent: Agent): { provider: "gemini" | "openai"; model: string; apiKey: string } {
  const custom = agent.inteligencia.modelosCustomizados?.find(
    (m) => m.nome === agent.inteligencia.modelo
  );
  if (!custom) {
    return { provider: "gemini", model: "gemini-1.5-flash", apiKey: "" };
  }
  return { provider: custom.provider, model: custom.modelId, apiKey: custom.apiKey };
}

// ─── Conversão DB (tabela `agents`) → Agent (UI) ──────────────────────────────
function fromDbRow(row: any): Agent {
  return {
    id: row.id,
    nome: row.name || "",
    descricao: row.description || "",
    avatar: row.avatar || "",
    emoji: row.avatar || "🤖",
    persona: row.system_prompt || "",
    conhecimento: {
      documentos: Array.isArray(row.attached_files)
        ? row.attached_files.map((f: any): AttachedDoc => ({
            id: f?.id || crypto.randomUUID(),
            name: f?.name || "",
            size: typeof f?.size === "number" ? f.size : 0,
            type: (f?.name || "").toLowerCase().endsWith(".pdf") ? "pdf" : "docx",
            content: f?.content || "",
          }))
        : [],
      baseLocal: row.knowledge_base || "",
      conhecimentoGlobal: Array.isArray(row.global_knowledge_ids) ? row.global_knowledge_ids : [],
    },
    requisicoes: {
      globais: [],
      personalizadas: Array.isArray(row.tools)
        ? row.tools.map((t: any) => ({ id: t.id, nome: t.name, dados: t.parameters || "" }))
        : [],
    },
    inteligencia: {
      modelo: row.model || "",
      temperatura: typeof row.temperature === "number" ? row.temperature : 0.7,
      topP: typeof row.top_p === "number" ? row.top_p : 0.85,
      reasoning: false,
      maxTokens: typeof row.max_tokens === "number" ? row.max_tokens : 2048,
      modelosCustomizados: row.model
        ? [{
            id: "saved-model",
            nome: row.model,
            modelId: row.model,
            provider: row.provider === "openai" ? "openai" : "gemini",
            apiKey: row.api_key || "",
          }]
        : [],
    },
    embed: {
      linkCompartilhamento: `${window.location.origin}/chat/${row.id}`,
      iframe: `<iframe src="${window.location.origin}/embed/${row.id}" width="400" height="600"></iframe>`,
      chatWidget: `<script src="${window.location.origin}/widget.js" data-agent="${row.id}"></script>`,
    },
    isGlobal: !!row.is_public,
    dataCriacao: row.created_at || new Date().toISOString(),
  };
}

// ─── Conversão Agent (UI) → DB (tabela `agents`) ──────────────────────────────
// Só enviamos colunas confirmadas em api/chat.ts / api/llm.ts para não quebrar
// o insert/update caso o schema real tenha nomes diferentes dos supostos aqui.
async function toDbRow(agent: Agent): Promise<Record<string, any>> {
  const { provider, model, apiKey } = resolveModel(agent);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    id: agent.id,
    name: agent.nome,
    description: agent.descricao,
    avatar: agent.emoji || agent.avatar || "🤖",
    provider,
    model,
    api_key: apiKey,
    system_prompt: agent.persona,
    temperature: agent.inteligencia.temperatura,
    top_p: agent.inteligencia.topP,
    max_tokens: agent.inteligencia.maxTokens,
    knowledge_base: agent.conhecimento.baseLocal,
    global_knowledge_ids: agent.conhecimento.conhecimentoGlobal,
    attached_files: agent.conhecimento.documentos.map((d) => ({
      id: d.id,
      name: d.name,
      size: d.size,
      type: d.type === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: sanitizeForPostgres(d.content),
    })),
    is_public: agent.isGlobal,
    tools: agent.requisicoes.personalizadas.map((p) => ({
      id: p.id,
      name: p.nome,
      description: p.nome,
      enabled: true,
      parameters: p.dados || "{}",
      method: "POST",
    })),
    ...(user?.id ? { user_id: user.id } : {}),
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────
export async function fetchAgents(): Promise<Agent[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const { data: userData } = await supabase.auth.getUser();
  console.log("[agentsApi] fetchAgents chamado. Sessão presente?", !!sessionData?.session);
  console.log("[agentsApi] Usuário autenticado:", userData?.user?.id, userData?.user?.email);

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("[agentsApi] Resultado da query 'agents': linhas =", data?.length, "erro =", error);

  if (error) throw error;
  return (data || []).map(fromDbRow);
}

export async function saveAgent(agent: Agent): Promise<Agent> {
  const payload = await toDbRow(agent);
  const { data, error } = await supabase
    .from("agents")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return fromDbRow(data);
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) throw error;
}

// ─── Chat (usa a mesma rota /api/llm que a UI antiga usa em services/llmService.ts)
async function buildKnowledgeContext(agent: Agent): Promise<string> {
  const parts: string[] = [];
  if (agent.conhecimento.baseLocal.trim()) {
    parts.push("[BASE DE CONHECIMENTO ESTÁTICA]:\n" + agent.conhecimento.baseLocal);
  }
  for (const doc of agent.conhecimento.documentos) {
    if (doc.content.trim()) {
      parts.push(`[DOCUMENTO ANEXADO: ${doc.name}]:\n` + doc.content);
    }
  }
  if (agent.conhecimento.conhecimentoGlobal.length > 0) {
    try {
      const globalKnowledges = await fetchGlobalAssets<{ id: string; title: string; baseConhecimento: string }>("knowledge");
      for (const id of agent.conhecimento.conhecimentoGlobal) {
        const asset = globalKnowledges.find((k) => k.id === id);
        if (asset?.baseConhecimento?.trim()) {
          parts.push(`[CONHECIMENTO GLOBAL: ${asset.title}]:\n` + asset.baseConhecimento);
        }
      }
    } catch (err) {
      console.error("[agentsApi] Erro ao carregar conhecimentos globais para o chat:", err);
    }
  }
  return parts.join("\n\n");
}

export async function chatWithAgent(
  agent: Agent,
  history: { role: "user" | "assistant"; content: string }[],
  message: string
): Promise<string> {
  const { provider, model, apiKey } = resolveModel(agent);
  const knowledgeContext = await buildKnowledgeContext(agent);
  const systemPrompt = knowledgeContext ? `${knowledgeContext}\n\n${agent.persona}` : agent.persona;

  const agentConfig = {
    id: agent.id,
    name: agent.nome,
    description: agent.descricao,
    avatar: agent.emoji,
    provider,
    model,
    apiKey,
    systemPrompt,
    preset: "balanced",
    temperature: agent.inteligencia.temperatura,
    topP: agent.inteligencia.topP,
    presencePenalty: 0,
    frequencyPenalty: 0,
    maxTokens: agent.inteligencia.maxTokens,
    responseFormat: "text",
    tools: [],
    created_at: Date.now(),
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch("/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ agent: agentConfig, history, newMessage: message }),
  });

  if (!response.ok) {
    let errorMessage = `Erro ${response.status} ao falar com a IA.`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // resposta não era JSON, mantém mensagem genérica
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.content || "";
}
