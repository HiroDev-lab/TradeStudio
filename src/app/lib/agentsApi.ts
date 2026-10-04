// Camada de integração entre a interface (tipo `Agent`, em src/app/App.tsx) e
// o backend: tabela `agents` no Supabase (protegida por RLS) e a função
// serverless /api/llm.
//
// A UI usa um formato de agente diferente do salvo no banco (campos em
// português, aninhados); este arquivo é o tradutor entre os dois lados.

import { supabase, authHeader } from "./supabase";
import type { Agent, AttachedDoc, Provider } from "../App";

function toProvider(value: unknown): Provider {
  return value === "openai" || value === "openrouter" ? value : "gemini";
}

// Remove caracteres nulos e de controle que o Postgres não aceita em campos JSONB/Text.
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
function sanitizeForPostgres(str: string): string {
  if (!str) return "";
  return str.replace(CONTROL_CHARS_RE, "");
}

export function embedFor(agentId: string): Agent["embed"] {
  const origin = window.location.origin;
  return {
    linkCompartilhamento: `${origin}/chat/${agentId}`,
    iframe: `<iframe src="${origin}/embed/${agentId}" width="400" height="600"></iframe>`,
    chatWidget: `<script src="${origin}/widget.js" data-agent="${agentId}"></script>`,
  };
}

// Provedor, id real do modelo e chave digitada (se houver) do modelo
// selecionado na aba "Inteligência". Sem modelo selecionado (model vazio), o
// servidor usa o provedor e o modelo padrão da empresa.
function resolveModel(agent: Agent): { provider: Provider; model: string; apiKey: string } {
  const selected = agent.inteligencia.modelosCustomizados.find((m) => m.nome === agent.inteligencia.modelo);
  if (!selected) return { provider: "gemini", model: "", apiKey: "" };
  return { provider: selected.provider, model: selected.modelId, apiKey: selected.apiKey.trim() };
}

// ─── Conversão DB (tabela `agents`) → Agent (UI) ──────────────────────────────
function fromDbRow(row: any): Agent {
  const provider = toProvider(row.provider);

  // As chaves de API nunca voltam do banco: os modelos chegam sem chave e o
  // servidor usa a que está salva (ver `chaveSalva`).
  const modelos: Agent["inteligencia"]["modelosCustomizados"] = (Array.isArray(row.custom_models) ? row.custom_models : [])
    .filter((m: any) => m?.nome && m?.modelId)
    .map((m: any) => ({
      id: m.id || crypto.randomUUID(),
      nome: m.nome,
      modelId: m.modelId,
      provider: toProvider(m.provider),
      apiKey: "",
    }));
  let selected = modelos.find((m) => m.modelId === row.model && m.provider === provider);
  if (!selected && row.model) {
    selected = { id: crypto.randomUUID(), nome: row.model, modelId: row.model, provider, apiKey: "" };
    modelos.push(selected);
  }

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
      globais: Array.isArray(row.global_request_ids) ? row.global_request_ids : [],
      personalizadas: Array.isArray(row.tools)
        ? row.tools.map((t: any) => ({ id: t.id, nome: t.name, dados: t.parameters || "" }))
        : [],
    },
    inteligencia: {
      modelo: selected?.nome || "",
      temperatura: typeof row.temperature === "number" ? row.temperature : 0.7,
      topP: typeof row.top_p === "number" ? row.top_p : 0.85,
      reasoning: !!row.is_reasoning,
      maxTokens: typeof row.max_tokens === "number" ? row.max_tokens : 4096,
      modelosCustomizados: modelos,
      chaveSalva: row.has_api_key ? { provider } : null,
    },
    embed: embedFor(row.id),
    isGlobal: !!row.is_public,
    dataCriacao: row.created_at || new Date().toISOString(),
  };
}

// ─── Conversão Agent (UI) → DB (tabela `agents`) ──────────────────────────────
// `user_id` não entra aqui: o banco preenche com o usuário logado na criação
// e ele não muda quando um gestor edita o agente de outra pessoa.
function toDbRow(agent: Agent): Record<string, any> {
  const { provider, model } = resolveModel(agent);

  return {
    name: agent.nome,
    description: agent.descricao,
    avatar: agent.emoji || agent.avatar || "🤖",
    provider,
    model,
    custom_models: agent.inteligencia.modelosCustomizados.map((m) => ({
      id: m.id,
      nome: m.nome,
      modelId: m.modelId,
      provider: m.provider,
    })),
    system_prompt: agent.persona,
    temperature: agent.inteligencia.temperatura,
    top_p: agent.inteligencia.topP,
    max_tokens: agent.inteligencia.maxTokens,
    is_reasoning: agent.inteligencia.reasoning,
    knowledge_base: sanitizeForPostgres(agent.conhecimento.baseLocal),
    global_knowledge_ids: agent.conhecimento.conhecimentoGlobal,
    global_request_ids: agent.requisicoes.globais,
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
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────
export async function fetchAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(fromDbRow);
}

export async function saveAgent(agent: Agent): Promise<Agent> {
  const payload = toDbRow(agent);

  // Tenta atualizar; se nenhuma linha voltar, o agente ainda não existe (ou
  // não é editável por este usuário) e a criação abaixo desempata.
  let { data, error } = await supabase.from("agents").update(payload).eq("id", agent.id).select("*").maybeSingle();
  if (error) throw error;

  if (!data) {
    ({ data, error } = await supabase.from("agents").insert({ id: agent.id, ...payload }).select("*").single());
    if (error?.code === "23505") {
      throw new Error("Você não tem permissão para editar este agente. Duplique-o para criar a sua versão.");
    }
    if (error) throw error;
  }

  // A chave fica numa tabela que o navegador não lê. Uma chave nova substitui a
  // salva; trocar de provedor sem informar chave apaga a antiga, que não serve mais.
  const saved = fromDbRow(data);
  const { provider, apiKey } = resolveModel(agent);
  const chaveSalva = agent.inteligencia.chaveSalva;
  if (apiKey || (chaveSalva && chaveSalva.provider !== provider)) {
    const { error: keyError } = await supabase.rpc("definir_chave_agente", { p_agent_id: saved.id, p_api_key: apiKey });
    if (keyError) throw keyError;
    saved.inteligencia.chaveSalva = apiKey ? { provider } : null;
  }

  return saved;
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) throw error;
}

// ─── Chat de teste (/api/llm) ─────────────────────────────────────────────────
// Envia o agente como está na tela, mesmo com alterações não salvas. O
// servidor monta a base de conhecimento e resolve a chave de API.
export async function chatWithAgent(
  agent: Agent,
  history: { role: "user" | "assistant"; content: string }[],
  message: string,
  conversationId: string | null
): Promise<{ content: string; conversationId: string | null }> {
  const { provider, model, apiKey } = resolveModel(agent);

  const response = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({
      agent: {
        id: agent.id,
        name: agent.nome,
        provider,
        model,
        apiKey,
        systemPrompt: agent.persona,
        temperature: agent.inteligencia.temperatura,
        topP: agent.inteligencia.topP,
        maxTokens: agent.inteligencia.maxTokens,
        reasoning: agent.inteligencia.reasoning,
        knowledgeBase: agent.conhecimento.baseLocal,
        attachedFiles: agent.conhecimento.documentos.map((d) => ({ name: d.name, content: d.content })),
        globalKnowledgeIds: agent.conhecimento.conhecimentoGlobal,
      },
      history,
      newMessage: message,
      conversationId,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Erro ${response.status} ao falar com a IA.`);
  }
  return { content: data?.content || "", conversationId: data?.conversationId || null };
}
