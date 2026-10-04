// Ponto único de chamada aos provedores de IA. Tanto o chat do app
// (api/llm.ts) quanto a API externa (api/chat.ts) passam por aqui.

export type Provider = 'gemini' | 'openai' | 'openrouter';

export function toProvider(value: unknown): Provider {
  return value === 'openai' || value === 'openrouter' ? value : 'gemini';
}

export interface HistoryMessage {
  role: string;
  content: string;
}

export interface ModelCall {
  provider: Provider;
  /** Vazio = agente sem modelo escolhido: usa o provedor e o modelo padrão da empresa. */
  model: string;
  /** Chave própria do agente. Sem ela, usa a chave da empresa (variável de ambiente). */
  apiKey?: string;
  systemPrompt: string;
  history: HistoryMessage[];
  message: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** Modelos de raciocínio (o1/o3/gpt-5...) não aceitam temperatura nem top_p. */
  reasoning?: boolean;
}

export interface ModelResult {
  content: string;
  usage: { totalTokens: number };
}

/** Erro com status HTTP e mensagem que pode ser mostrada ao usuário. */
export class LLMError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const PROVIDERS: Record<Provider, { nome: string; envKey: string; defaultModel: string }> = {
  gemini: { nome: 'Gemini', envKey: 'GEMINI_API_KEY', defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash' },
  openai: { nome: 'OpenAI', envKey: 'OPENAI_API_KEY', defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini' },
  // Modelos gratuitos de chat, em ordem de preferência: se o primeiro estiver fora do ar ou
  // com limite estourado, o OpenRouter tenta o próximo. O roteador "openrouter/free" não serve
  // de padrão porque sorteia entre todos os gratuitos, inclusive modelos que não são de chat.
  openrouter: {
    nome: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL
      || 'nvidia/nemotron-3-ultra-550b-a55b:free,qwen/qwen3.8-27b:free,nvidia/nemotron-3-super-120b-a12b:free',
  },
};

const OPENAI_COMPATIBLE_URL: Record<'openai' | 'openrouter', string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

/** Provedor usado por agentes sem modelo escolhido: DEFAULT_PROVIDER ou o primeiro que tiver chave no servidor. */
function defaultProvider(): Provider {
  const configured = process.env.DEFAULT_PROVIDER;
  if (configured === 'gemini' || configured === 'openai' || configured === 'openrouter') return configured;
  return (Object.keys(PROVIDERS) as Provider[]).find(p => process.env[PROVIDERS[p].envKey]) || 'gemini';
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

function resolveApiKey(provider: Provider, apiKey?: string): string {
  const key = apiKey?.trim() || process.env[PROVIDERS[provider].envKey] || '';
  if (!key) {
    throw new LLMError(`Nenhuma chave de API configurada para ${PROVIDERS[provider].nome}. Informe uma chave no modelo do agente ou configure a chave padrão no servidor.`, 400);
  }
  return key;
}

const RETRY_DELAYS_MS = [800, 2000];

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) return response;
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

async function callGemini(call: ModelCall, apiKey: string, model: string): Promise<ModelResult> {
  const contents = [
    ...call.history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: call.message }] },
  ];

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        ...(call.systemPrompt ? { systemInstruction: { parts: [{ text: call.systemPrompt }] } } : {}),
        contents,
        generationConfig: {
          temperature: clamp(call.temperature, 0, 2, 0.7),
          topP: clamp(call.topP, 0, 1, 0.85),
          maxOutputTokens: clamp(call.maxTokens, 1, 65536, 2048),
        },
      }),
    }
  );

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LLMError(
      `Gemini (${model}): ${data.error?.message || `erro ${response.status}`}`,
      response.status === 429 ? 429 : 502
    );
  }

  const candidate = data.candidates?.[0];
  const content = (candidate?.content?.parts || []).map((p: any) => p.text || '').join('');
  if (!content) {
    const motivo = candidate?.finishReason === 'MAX_TOKENS'
      ? 'a resposta estourou o limite de tokens — aumente o "Max Output Tokens" do agente'
      : `a IA não retornou texto (${candidate?.finishReason || data.promptFeedback?.blockReason || 'motivo desconhecido'})`;
    throw new LLMError(`Gemini (${model}): ${motivo}.`);
  }

  return { content, usage: { totalTokens: data.usageMetadata?.totalTokenCount || 0 } };
}

// OpenAI e OpenRouter falam o mesmo protocolo (chat completions).
async function callOpenAICompatible(provider: 'openai' | 'openrouter', call: ModelCall, apiKey: string, model: string): Promise<ModelResult> {
  const nome = PROVIDERS[provider].nome;
  // No OpenRouter o modelo pode ser uma lista separada por vírgula: os seguintes são reservas.
  const fallbacks = provider === 'openrouter' ? model.split(',').map(m => m.trim()).filter(Boolean) : [model];
  model = fallbacks[0];
  const messages = [
    ...(call.systemPrompt ? [{ role: 'system', content: call.systemPrompt }] : []),
    ...call.history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: call.message },
  ];

  const response = await fetchWithRetry(OPENAI_COMPATIBLE_URL[provider], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      ...(fallbacks.length > 1 ? { models: fallbacks } : {}),
      messages,
      max_completion_tokens: clamp(call.maxTokens, 1, 65536, 2048),
      ...(call.reasoning
        ? {}
        : { temperature: clamp(call.temperature, 0, 2, 0.7), top_p: clamp(call.topP, 0, 1, 0.85) }),
    }),
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LLMError(
      `${nome} (${model}): ${data.error?.message || `erro ${response.status}`}`,
      response.status === 429 ? 429 : 502
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new LLMError(`${nome} (${model}): a IA não retornou texto (${data.choices?.[0]?.finish_reason || 'motivo desconhecido'}).`);
  }

  return { content, usage: { totalTokens: data.usage?.total_tokens || 0 } };
}

// O modelo não sabe que dia é hoje (responde com a data do fim do treinamento dele).
function withCurrentDate(systemPrompt: string): string {
  const agora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
  return `[Data e hora atuais: ${agora}, horário de Brasília]\n\n${systemPrompt}`.trim();
}

export async function callModel(input: ModelCall): Promise<ModelResult> {
  const call = { ...input, systemPrompt: withCurrentDate(input.systemPrompt) };
  // Sem modelo escolhido não há provedor nem chave própria que valham: cai no padrão da empresa.
  const hasModel = !!call.model?.trim();
  const provider = hasModel ? toProvider(call.provider) : defaultProvider();
  const model = hasModel ? call.model.trim() : PROVIDERS[provider].defaultModel;
  const apiKey = resolveApiKey(provider, hasModel ? call.apiKey : undefined);
  return provider === 'gemini'
    ? callGemini(call, apiKey, model)
    : callOpenAICompatible(provider, call, apiKey, model);
}
