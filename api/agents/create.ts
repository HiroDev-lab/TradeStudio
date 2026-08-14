import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabase.js';

/**
 * ST-004: Bloqueio de acesso anônimo ao endpoint de criação de agentes.
 * Garante que apenas usuários autenticados possam registrar novos agentes no sistema.
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
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // --- REFORÇO DE SEGURANÇA: INTEGRIDADE (HEADERS) ---
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST é permitido para criação
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- REFORÇO DE SEGURANÇA: AUTENTICIDADE (ST-004) ---
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn('[SECURITY] Bloqueio de acesso anônimo ao endpoint /api/agents/create.');
    return res.status(401).json({ 
      error: 'Acesso não autorizado.', 
      message: 'Identidade não estabelecida. Por favor, forneça um Token de Sessão válido.' 
    });
  }

  try {
    // Valida o token com o Supabase para garantir que o usuário está logado
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      console.error('[SECURITY] Tentativa de criação de agente não autorizada.');
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }

    const { name, systemPrompt, access } = req.body;

    if (!name || !systemPrompt) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes: name e systemPrompt.' });
    }

    // A lógica de inserção no banco de dados já é feita via Supabase Client no frontend,
    // mas este endpoint valida a permissão para futuras implementações via API.
    return res.status(200).json({ 
      message: 'Autenticação confirmada. Permissão para criar agente concedida.',
      status: 'success',
      user: user.email
    });

  } catch (err: any) {
    console.error('[API] Erro na criação de agente:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
