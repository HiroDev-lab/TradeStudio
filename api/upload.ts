import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase.js';

/**
 * ST-003: Bloqueio de acesso anônimo ao endpoint de upload.
 * Mesmo que a lógica de processamento de arquivos seja feita no cliente,
 * este endpoint existe para garantir que tentativas de upload via API sejam autenticadas.
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

  // Apenas POST é permitido para uploads
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- REFORÇO DE SEGURANÇA: AUTENTICIDADE (ST-003) ---
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.warn('[SECURITY] Bloqueio de acesso anônimo ao endpoint /api/upload.');
    return res.status(401).json({ 
      error: 'Acesso não autorizado.', 
      message: 'Identidade não estabelecida. Por favor, forneça um Token de Sessão válido.' 
    });
  }

  try {
    // Valida o token com o Supabase para garantir que o usuário está logado
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      console.error('[SECURITY] Tentativa de acesso não autorizado ao upload.');
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }

    // Por enquanto, o sistema processa arquivos localmente no frontend.
    // Este endpoint pode ser expandido no futuro para suportar uploads para Supabase Storage.
    return res.status(200).json({ 
      message: 'Autenticação confirmada.',
      status: 'ready_for_implementation',
      user: user.email
    });

  } catch (err: any) {
    console.error('[API] Erro no upload:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
