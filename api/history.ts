import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServiceRole } from './_lib/supabase.js';
import { preflight, requireCaller, isUuid } from './_lib/http.js';

/**
 * Dados das telas "Histórico e Sync" e "Logs de Requisições". Gestores veem
 * tudo; os demais, só o que é deles.
 *
 *   GET /api/history                   → conversas (tabela `sessions`), uma linha por conversa
 *   GET /api/history?id=<conversa>     → todas as mensagens de uma conversa
 *   GET /api/history?tipo=requisicoes  → execuções (tabela `tool_logs`), uma linha por mensagem enviada à IA
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, 'GET')) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const caller = await requireCaller(req, res);
  if (!caller) return;

  if (req.query.id) {
    if (!isUuid(req.query.id)) {
      return res.status(400).json({ error: 'id inválido.' });
    }
    const { data: session, error } = await supabaseServiceRole
      .from('sessions')
      .select('user_id, messages')
      .eq('id', req.query.id)
      .maybeSingle();
    if (error) {
      console.error('[api/history] Erro ao buscar conversa:', error);
      return res.status(500).json({ error: 'Erro ao buscar a conversa.' });
    }
    if (!session || (!caller.isGestor && session.user_id !== caller.user.id)) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }
    const messages = (Array.isArray(session.messages) ? session.messages : []).map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
    return res.status(200).json({ messages });
  }

  if (req.query.tipo === 'requisicoes') {
    let query = supabaseServiceRole
      .from('tool_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!caller.isGestor) query = query.eq('user_email', caller.user.email || '');

    const { data: rows, error } = await query;
    if (error) {
      console.error('[api/history] Erro ao buscar logs:', error);
      return res.status(500).json({ error: 'Erro ao buscar os logs do banco' });
    }

    return res.status(200).json(
      (rows || []).map(row => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.payload?.agentName || 'Agente removido',
        agentModel: row.payload?.agentModel || '',
        provider: row.payload?.provider || '',
        userEmail: row.user_email || '',
        toolName: row.tool_name || '',
        input: row.payload?.message || '',
        output: row.response || '',
        phone: row.phone || '',
        timestamp: new Date(row.created_at).getTime(),
        status: row.status === 'error' ? 'error' : 'success',
      }))
    );
  }

  let query = supabaseServiceRole
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (!caller.isGestor) query = query.eq('user_id', caller.user.id);

  const { data: sessions, error } = await query;
  if (error) {
    console.error('[api/history] Erro ao buscar histórico:', error);
    return res.status(500).json({ error: 'Erro ao buscar histórico do banco' });
  }

  const logs = (sessions || []).map(session => {
    const messages: any[] = Array.isArray(session.messages) ? session.messages : [];
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

    return {
      id: session.id,
      agentId: session.agent_id,
      agentName: session.agent_name || 'Agente removido',
      agentModel: session.agent_model || '',
      userEmail: session.user_email || '',
      origem: session.origem,
      totalMensagens: messages.length,
      input: lastUserMsg?.content || 'Sessão iniciada',
      output: lastAssistantMsg?.content || 'Sem resposta',
      startTime: new Date(session.created_at || session.updated_at).getTime(),
      timestamp: new Date(session.updated_at).getTime(),
      status: session.status === 'error' ? 'error' : 'success',
    };
  });

  return res.status(200).json(logs);
}
