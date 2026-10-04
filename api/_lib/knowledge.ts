import { supabaseServiceRole } from './supabase.js';
import { fetchGoogleFileText } from './google.js';

/**
 * Conteúdo de um conhecimento global. Quando ele aponta para Google Docs, usa
 * o cache e só baixa de novo depois de `sync_interval` horas.
 */
async function globalKnowledgeText(k: any): Promise<string> {
  if (!k.google_doc_id) return k.content || '';

  const lastSync = k.last_sync_at ? new Date(k.last_sync_at).getTime() : 0;
  const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);
  if (k.cached_content && hoursSinceSync < (k.sync_interval || 24)) {
    return [k.content, k.cached_content].filter(Boolean).join('\n\n');
  }

  const docs: string[] = [];
  for (const link of String(k.google_doc_id).split(',').map(s => s.trim()).filter(Boolean)) {
    try {
      docs.push(await fetchGoogleFileText(link));
    } catch (err) {
      console.error(`[knowledge] Falha ao sincronizar "${k.title}" (${link}):`, err);
    }
  }

  if (docs.length === 0) {
    return [k.content, k.cached_content].filter(Boolean).join('\n\n');
  }

  const synced = docs.join('\n\n');
  await supabaseServiceRole
    .from('global_knowledge')
    .update({ cached_content: synced, last_sync_at: new Date().toISOString() })
    .eq('id', k.id);
  return [k.content, synced].filter(Boolean).join('\n\n');
}

/** Monta o bloco de conhecimento que vai antes do prompt de sistema do agente. */
export async function buildKnowledgeContext(agent: any): Promise<string> {
  const parts: string[] = [];

  if (agent.knowledge_base?.trim()) {
    parts.push('[BASE DE CONHECIMENTO ESTÁTICA]:\n' + agent.knowledge_base);
  }

  for (const file of Array.isArray(agent.attached_files) ? agent.attached_files : []) {
    if (file?.content?.trim()) {
      parts.push(`[DOCUMENTO ANEXADO: ${file.name}]:\n${file.content}`);
    }
  }

  const globalIds: string[] = Array.isArray(agent.global_knowledge_ids) ? agent.global_knowledge_ids : [];
  if (globalIds.length > 0) {
    const { data, error } = await supabaseServiceRole.from('global_knowledge').select('*').in('id', globalIds);
    if (error) console.error('[knowledge] Erro ao buscar conhecimentos globais:', error);
    for (const k of data || []) {
      const text = await globalKnowledgeText(k);
      if (text.trim()) parts.push(`[CONHECIMENTO GLOBAL: ${k.title}]:\n${text}`);
    }
  }

  if (parts.length === 0) return '';
  return (
    parts.join('\n\n') +
    '\n\nUse as informações das Bases de Conhecimento acima para responder com precisão. Se a informação não estiver na base, responda com seu conhecimento geral, mas priorize sempre a base fornecida.'
  );
}
