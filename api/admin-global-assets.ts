import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServiceRole } from './_lib/supabase.js';
import { preflight, requireCaller } from './_lib/http.js';

/**
 * Ativos Globais (Conhecimento e Requisições).
 *
 * Leitura liberada a qualquer usuário com acesso (os agentes de qualquer setor
 * precisam listar os ativos ao serem editados); escrita (criar/excluir)
 * restrita a quem gerencia usuários (admin/dev/lider/master), pela mesma
 * regra de api/admin-users.ts.
 */

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, 'GET, POST, DELETE')) return;

  const caller = await requireCaller(req, res);
  if (!caller) return;

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

    const podeGerenciar = caller.isGestor || caller.role === 'lider';
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
              created_by: caller.user.id,
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
    console.error('[api/admin-global-assets] Erro:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
