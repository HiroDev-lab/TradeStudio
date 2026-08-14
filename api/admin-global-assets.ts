import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, supabaseServiceRole } from '../lib/supabase.js';

/**
 * Ativos Globais (Conhecimento e Requisições).
 *
 * `global_knowledge` já existia no banco de produção (é lida de verdade por
 * api/chat.ts para montar o contexto dos agentes, com suporte a sync de
 * Google Docs/Sheets em `google_doc_id`/`cached_content`/`sync_interval`) —
 * por isso o mapeamento abaixo usa as colunas reais dela
 * (description/content/google_doc_id/sectors/is_public/allowed_roles), não um
 * schema inventado. `global_requests` é nova (ver
 * supabase/migrations/20260720_global_assets.sql), sem nenhum outro
 * consumidor ainda.
 *
 * Leitura liberada a qualquer usuário autenticado (agentes de qualquer setor
 * precisam listar os ativos ao serem editados); escrita (criar/excluir)
 * restrita a quem já gerencia usuários (admin/dev/lider/master), pela mesma
 * regra de api/admin/users.ts.
 */

const allowedOrigins = [
  'https://tradestudio-ai-studio.vercel.app',
  'https://tradestars-ai-studio.vercel.app',
  'https://tradestudio.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
];

type AssetType = 'knowledge' | 'requests';

function knowledgeFromRow(row: any): Record<string, any> {
  return {
    id: row.id,
    title: row.title,
    breveDescritivo: row.description || '',
    baseConhecimento: row.content || '',
    googleDocsId: row.google_doc_id || '',
    setores: row.sectors || [],
    isPublic: row.is_public ?? true,
    allowedRoles: row.allowed_roles || [],
    syncInterval: row.sync_interval ?? 24,
  };
}

function requestFromRow(row: any): Record<string, any> {
  return {
    id: row.id,
    title: row.title,
    breveDescritivo: row.breve_descritivo || '',
    emoji: row.emoji || '',
    url: row.url || '',
    metodo: row.metodo || 'GET',
    jsonSchema: row.json_schema || '',
    setores: row.setores || [],
  };
}

async function getCallerProfile(token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const masterEmail = process.env.JUNOS_ADMIN_MASTER_EMAIL || process.env.VITE_ADMIN_MASTER_EMAIL;
  const isMasterEmail = !!masterEmail && user.email === masterEmail;

  const { data: profile } = await supabaseServiceRole
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return {
    user,
    role: profile?.role as string | undefined,
    isMaster: !!profile?.is_master || isMasterEmail,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Identidade não estabelecida. Forneça um Token de Sessão válido.' });
  }

  const caller = await getCallerProfile(authHeader.replace('Bearer ', ''));
  if (!caller) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }

  const type = (req.query.type as string) || req.body?.type;
  if (type !== 'knowledge' && type !== 'requests') {
    return res.status(400).json({ error: 'Parâmetro "type" deve ser "knowledge" ou "requests".' });
  }
  const table = type === 'knowledge' ? 'global_knowledge' : 'global_requests';
  const mapRow = type === 'knowledge' ? knowledgeFromRow : requestFromRow;

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseServiceRole.from(table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ items: (data || []).map(mapRow) });
    }

    const podeGerenciar = caller.isMaster || ['admin', 'dev', 'lider'].includes(caller.role || '');
    if (!podeGerenciar) {
      return res.status(403).json({ error: 'Você não tem permissão para gerenciar ativos globais.' });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.title) {
        return res.status(400).json({ error: 'Campo obrigatório ausente: title.' });
      }

      const row: Record<string, any> =
        type === 'knowledge'
          ? {
              title: body.title,
              description: body.breveDescritivo || '',
              content: body.baseConhecimento || '',
              google_doc_id: body.googleDocsId || '',
              sectors: body.setores || [],
              is_public: true,
              allowed_roles: [],
              sync_interval: 24,
            }
          : {
              title: body.title,
              breve_descritivo: body.breveDescritivo || '',
              emoji: body.emoji || '',
              url: body.url || '',
              metodo: body.metodo || 'GET',
              json_schema: body.jsonSchema || '',
              setores: body.setores || [],
              created_by: caller.user.id,
            };

      const { data, error } = await supabaseServiceRole.from(table).insert(row).select().single();
      if (error) throw error;
      return res.status(200).json({ item: mapRow(data) });
    }

    if (req.method === 'DELETE') {
      const id = (req.query.id as string) || req.body?.id;
      if (!id) {
        return res.status(400).json({ error: 'Campo obrigatório ausente: id.' });
      }
      const { error } = await supabaseServiceRole.from(table).delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[API] Erro em /api/admin/global-assets:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
