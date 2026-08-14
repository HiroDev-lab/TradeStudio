import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, supabaseServiceRole } from '../lib/supabase.js';

/**
 * Endpoint para buscar o histórico de sessões do Supabase e sincronizar com o frontend.
 * Retorna os logs formatados para que a UI do TradeStudio possa exibir no Histórico & Sync.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuração de CORS
  const allowedOrigins = [
    'https://tradestudio-ai-studio.vercel.app',
    'https://tradestars-ai-studio.vercel.app',
    'https://tradestudio.com.br',
    'http://localhost:5173'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // --- REFORÇO DE SEGURANÇA: INTEGRIDADE (HEADERS) ---
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- REFORÇO DE SEGURANÇA: AUTENTICIDADE ---
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Acesso não autorizado. Token ausente.' });
  }

  try {
    // Valida o token com o Supabase para garantir que o usuário está logado
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      console.error('[SECURITY] Tentativa de acesso não autorizado ao histórico.');
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }

    // Busca as últimas 50 sessões ordenadas por atualização
    const { data: sessions, error } = await supabaseServiceRole
      .from('sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erro ao buscar histórico:', error);
      return res.status(500).json({ error: 'Erro ao buscar histórico do banco' });
    }

    // Mapeia para o formato RunLog que o App.tsx espera no Sync
    // O App.tsx espera: { id, input, output, startTime, timestamp, agentName, agentModel, agentId }
    const formattedLogs = sessions.map(session => {
      const messages = session.messages || [];
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

      return {
        id: session.id,
        agentId: session.agent_id,
        agentName: session.agent_name || 'Agente Externo',
        agentModel: session.agent_model || 'gemini-1.5-flash',
        input: lastUserMsg?.content || 'Sessão iniciada',
        output: lastAssistantMsg?.content || 'Sem resposta',
        startTime: new Date(session.created_at || session.updated_at).getTime(),
        timestamp: new Date(session.updated_at).getTime(),
        status: 'success'
      };
    });

    return res.status(200).json(formattedLogs);

  } catch (err: any) {
    console.error('[API] Erro no histórico:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
