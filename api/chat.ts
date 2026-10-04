import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServiceRole } from './_lib/supabase.js';
import { preflight, getCaller, isUuid } from './_lib/http.js';
import { callModel, LLMError, toProvider } from './_lib/llm.js';
import { recordTurn, normalizeHistory, loadSession } from './_lib/sessions.js';
import { buildKnowledgeContext } from './_lib/knowledge.js';

/**
 * API externa: POST /api/chat/:agentId (n8n, sites, integrações).
 *
 * Diferente de api/llm.ts, aqui o agente é sempre o que está salvo no banco.
 * Quem pode chamar:
 *   - qualquer um, se o agente for público;
 *   - o dono do agente ou um gestor, com o token de sessão;
 *   - quem enviar no header `x-api-key` a chave própria cadastrada no agente.
 *
 * Corpo: { message, inputs?, history?, conversation_id? }. Enviando o
 * `conversation_id` devolvido na resposta anterior, o histórico é retomado do
 * banco e `history` pode ser omitido.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, 'POST')) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentId = req.query.agentId || req.body?.agentId;
  if (!isUuid(agentId)) {
    return res.status(400).json({ error: 'agentId é obrigatório.' });
  }

  const [{ data: agent, error: agentError }, { data: secret }] = await Promise.all([
    supabaseServiceRole.from('agents').select('*').eq('id', agentId).maybeSingle(),
    supabaseServiceRole.from('agent_secrets').select('api_key').eq('agent_id', agentId).maybeSingle(),
  ]);
  if (agentError) {
    console.error('[api/chat] Erro ao buscar agente:', agentError);
    return res.status(500).json({ error: 'Erro interno' });
  }
  if (!agent) {
    return res.status(404).json({ error: 'Agente não encontrado.' });
  }

  const caller = await getCaller(req);
  const apiKeyHeader = req.headers['x-api-key'];
  const hasAccess =
    agent.is_public ||
    (!!caller?.hasAccess && (caller.user.id === agent.user_id || caller.isGestor)) ||
    (!!secret?.api_key && apiKeyHeader === secret.api_key);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Acesso negado.', message: 'Você não tem permissão para acessar este agente.' });
  }

  const { inputs } = req.body || {};
  let message: string = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message && !inputs) {
    return res.status(400).json({ error: 'message (ou inputs) é obrigatório.' });
  }
  if (!message) message = 'Analise os dados e gere a resposta';
  if (inputs) message += '\n\n--- DADOS DO USUÁRIO (INPUTS) ---\n' + JSON.stringify(inputs, null, 2);

  const conversationId = [req.body?.conversation_id, req.query.conversationId].find(isUuid) ?? null;
  let history = normalizeHistory(req.body?.history);
  if (history.length === 0) {
    const session = await loadSession(conversationId);
    if (session && session.agent_id === agentId) history = normalizeHistory(session.messages);
  }

  const provider = toProvider(agent.provider);
  const turn = {
    conversationId,
    agentId,
    agentName: agent.name || 'Agente sem nome',
    agentModel: agent.model || '',
    provider,
    userId: caller?.user.id,
    userEmail: caller?.user.email || 'API externa',
    origem: 'api' as const,
    history,
    message,
    phone: typeof req.body?.phone === 'string' ? req.body.phone : null,
  };

  try {
    const knowledge = await buildKnowledgeContext(agent);

    // Em conversa retomada o modelo tende a se apresentar de novo a cada mensagem.
    const continuing = history.length > 0
      ? '[CONVERSA EM ANDAMENTO] Você já se apresentou nas mensagens anteriores. Não cumprimente nem se apresente de novo: responda diretamente ao que foi perguntado agora.'
      : '';

    const result = await callModel({
      provider,
      model: agent.model,
      apiKey: secret?.api_key,
      systemPrompt: [knowledge, continuing, agent.system_prompt].filter(Boolean).join('\n\n'),
      history,
      message,
      temperature: agent.temperature,
      topP: agent.top_p,
      maxTokens: agent.max_tokens,
      reasoning: !!agent.is_reasoning,
    });

    const saved = await recordTurn({ ...turn, reply: result.content });
    return res.status(200).json({
      ...result,
      conversation_id: saved.conversationId,
      message_id: saved.messageId,
    });
  } catch (err: any) {
    console.error('[api/chat] Erro:', err);
    const isLlmError = err instanceof LLMError;
    await recordTurn({ ...turn, reply: null, error: err?.message });
    return res.status(isLlmError ? err.status : 500).json({
      error: isLlmError && err.status === 429 ? 'Limite de cota excedido' : 'Erro interno',
      message: isLlmError ? err.message : 'Ocorreu um erro ao processar sua solicitação.',
    });
  }
}
