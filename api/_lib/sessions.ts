import { supabaseServiceRole } from './supabase.js';
import { isUuid } from './http.js';

// O Postgres não aceita caracteres nulos/de controle em text e jsonb.
export function sanitizeForPostgres(str: string): string {
  if (!str) return '';
  return str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '');
}

const MAX_SAVED_MESSAGES = 40;
const MAX_LOG_RESPONSE_CHARS = 20_000;

export interface ConversationTurn {
  conversationId?: string | null;
  agentId?: string | null;
  agentName: string;
  agentModel: string;
  provider: string;
  userId?: string | null;
  userEmail: string;
  origem: 'app' | 'api';
  history: { role: string; content: string }[];
  message: string;
  /** Resposta da IA, ou `null` quando a chamada falhou. */
  reply: string | null;
  error?: string;
  phone?: string | null;
}

export async function loadSession(conversationId: unknown) {
  if (!isUuid(conversationId)) return null;
  const { data } = await supabaseServiceRole
    .from('sessions')
    .select('id, agent_id, user_id, messages')
    .eq('id', conversationId)
    .maybeSingle();
  return data;
}

/**
 * Registra uma troca de mensagens: atualiza (ou cria) a conversa em `sessions`
 * e grava uma linha em `tool_logs`. Falha de log nunca derruba o chat.
 */
export async function recordTurn(turn: ConversationTurn): Promise<{ conversationId: string | null; messageId: string }> {
  const now = new Date().toISOString();
  const messageId = crypto.randomUUID();
  const agentId = isUuid(turn.agentId) ? turn.agentId : null;
  const ok = turn.reply !== null;

  const messages = [
    ...turn.history,
    { id: crypto.randomUUID(), role: 'user', content: sanitizeForPostgres(turn.message), timestamp: Date.now() },
    ...(ok
      ? [{ id: messageId, role: 'assistant', content: sanitizeForPostgres(turn.reply as string), timestamp: Date.now() }]
      : []),
  ].slice(-MAX_SAVED_MESSAGES);

  let conversationId: string | null = isUuid(turn.conversationId) ? turn.conversationId : null;

  try {
    // Um id que já pertence a outra pessoa ou a outro agente não pode ser
    // sobrescrito: nesse caso a troca vira uma conversa nova.
    if (conversationId) {
      const existing = await loadSession(conversationId);
      if (existing && ((existing.user_id || null) !== (turn.userId || null) || existing.agent_id !== agentId)) {
        conversationId = null;
      }
    }

    const { data, error } = await supabaseServiceRole
      .from('sessions')
      .upsert(
        {
          ...(conversationId ? { id: conversationId } : {}),
          agent_id: agentId,
          agent_name: turn.agentName,
          agent_model: turn.agentModel,
          user_id: turn.userId || null,
          user_email: turn.userEmail,
          origem: turn.origem,
          status: ok ? 'success' : 'error',
          messages,
          updated_at: now,
        },
        { onConflict: 'id' }
      )
      .select('id')
      .single();
    if (error) throw error;
    conversationId = data.id;
  } catch (err) {
    console.error('[sessions] Falha ao salvar a conversa:', err);
  }

  try {
    const { error } = await supabaseServiceRole.from('tool_logs').insert({
      agent_id: agentId,
      user_email: turn.userEmail,
      tool_name: ok ? 'Execução Chat' : 'Execução Chat (Erro)',
      webhook_url: 'N/A',
      payload: {
        message: sanitizeForPostgres(turn.message),
        agentName: turn.agentName,
        agentModel: turn.agentModel,
        provider: turn.provider,
        conversationId,
        ...(turn.error ? { error: turn.error } : {}),
      },
      status: ok ? 'success' : 'error',
      response: ok ? sanitizeForPostgres((turn.reply as string).substring(0, MAX_LOG_RESPONSE_CHARS)) : `Erro: ${turn.error || 'desconhecido'}`,
      phone: turn.phone || null,
    });
    if (error) throw error;
  } catch (err) {
    console.error('[sessions] Falha ao gravar o log:', err);
  }

  return { conversationId, messageId };
}

/** Só aceita o que tem cara de histórico de chat, para não gravar lixo vindo do cliente. */
export function normalizeHistory(history: unknown): { role: string; content: string }[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ ...m, content: sanitizeForPostgres(m.content) }));
}
