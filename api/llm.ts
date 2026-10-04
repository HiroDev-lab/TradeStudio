import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServiceRole } from './_lib/supabase.js';
import { preflight, requireCaller, isUuid, type Caller } from './_lib/http.js';
import { callModel, LLMError, toProvider, type Provider } from './_lib/llm.js';
import { recordTurn, normalizeHistory } from './_lib/sessions.js';
import { buildKnowledgeContext } from './_lib/knowledge.js';

/**
 * Chat de teste do editor de agentes.
 *
 * O navegador manda a configuração do agente como está na tela (inclusive
 * alterações ainda não salvas) e a mensagem. A chave de API nunca vem do
 * banco para o navegador: se o usuário não digitou uma chave nova, o servidor
 * busca a chave salva do agente e, na falta dela, usa a chave da empresa.
 */

async function savedApiKey(agentId: unknown, provider: Provider, caller: Caller): Promise<string> {
  if (!isUuid(agentId)) return '';

  const { data: agent } = await supabaseServiceRole
    .from('agents')
    .select('user_id, is_public, provider')
    .eq('id', agentId)
    .maybeSingle();
  if (!agent) return '';
  if (agent.user_id !== caller.user.id && !agent.is_public && !caller.isGestor) return '';
  // A chave salva é do provedor salvo; não serve se a tela já trocou de provedor.
  if (agent.provider !== provider) return '';

  const { data: secret } = await supabaseServiceRole
    .from('agent_secrets')
    .select('api_key')
    .eq('agent_id', agentId)
    .maybeSingle();
  return secret?.api_key || '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, 'POST')) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const caller = await requireCaller(req, res);
  if (!caller) return;

  const { agent, newMessage, conversationId } = req.body || {};
  const message = typeof newMessage === 'string' ? newMessage.trim() : '';
  if (!agent || !message) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: agent e newMessage.' });
  }

  const history = normalizeHistory(req.body.history);
  const provider = toProvider(agent.provider);
  const turn = {
    conversationId,
    agentId: agent.id,
    agentName: agent.name || 'Agente sem nome',
    agentModel: agent.model || '',
    provider,
    userId: caller.user.id,
    userEmail: caller.user.email || '',
    origem: 'app' as const,
    history,
    message,
  };

  try {
    const apiKey = (typeof agent.apiKey === 'string' && agent.apiKey.trim()) || (await savedApiKey(agent.id, provider, caller));

    const knowledge = await buildKnowledgeContext({
      knowledge_base: agent.knowledgeBase,
      attached_files: agent.attachedFiles,
      global_knowledge_ids: Array.isArray(agent.globalKnowledgeIds) ? agent.globalKnowledgeIds.filter(isUuid) : [],
    });

    const result = await callModel({
      provider,
      model: agent.model,
      apiKey,
      systemPrompt: [knowledge, agent.systemPrompt].filter(Boolean).join('\n\n'),
      history,
      message,
      temperature: agent.temperature,
      topP: agent.topP,
      maxTokens: agent.maxTokens,
      reasoning: !!agent.reasoning,
    });

    const saved = await recordTurn({ ...turn, reply: result.content });
    return res.status(200).json({ ...result, conversationId: saved.conversationId });
  } catch (err: any) {
    console.error('[api/llm] Erro:', err);
    const isLlmError = err instanceof LLMError;
    const messageToUser = isLlmError ? err.message : 'Erro interno ao falar com a IA.';
    const saved = await recordTurn({ ...turn, reply: null, error: err?.message });
    return res.status(isLlmError ? err.status : 500).json({ error: messageToUser, conversationId: saved.conversationId });
  }
}
