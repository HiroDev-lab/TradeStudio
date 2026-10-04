// Teste de ponta a ponta com usuários descartáveis (criados e apagados pelo próprio teste).
// Uso: npx tsx scripts/e2e.mts https://URL-DO-SITE   (lê as chaves de .env.local)
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

dotenv.config({ path: '.env.local' });
const BASE = process.argv[2];
const url = process.env.VITE_SUPABASE_URL!;
const anon = process.env.VITE_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, cond: boolean, extra: unknown = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 160) : ''}`);
  if (!cond) failures++;
}

const stamp = Date.now();
const created: string[] = [];
async function makeUser(tag: string, role: string | null) {
  const email = `e2e-${tag}-${stamp}@teste.tradestudio.dev`;
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.push(data.user.id);
  if (role) {
    const { error: pErr } = await admin.from('profiles').insert({ id: data.user.id, email, role });
    if (pErr) throw pErr;
  }
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data: s, error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  return { id: data.user.id, email, client, token: s.session!.access_token };
}

async function api(path: string, token: string | null, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { status: res.status, body };
}

try {
  const colab = await makeUser('colab', 'colaborador');
  const gestor = await makeUser('admin', 'admin');
  const semPerfil = await makeUser('semperfil', null);

  // ── Cadastro público desligado
  const pub = createClient(url, anon, { auth: { persistSession: false } });
  const su = await pub.auth.signUp({ email: `e2e-intruso-${stamp}@teste.tradestudio.dev`, password: randomBytes(12).toString('base64url') });
  check('cadastro público está desligado', !!su.error, su.error?.message);
  if (su.data.user) created.push(su.data.user.id);

  // ── Usuário sem perfil
  let r = await api('/api/history', semPerfil.token);
  check('sem perfil: API responde 403', r.status === 403, r.body);
  const sp = await semPerfil.client.from('agents').select('id');
  check('sem perfil: não lê agentes', (sp.data?.length ?? 0) === 0);

  // ── Colaborador cria agente pelo mesmo caminho do front (update -> insert)
  const agentId = crypto.randomUUID();
  const payload = { name: 'Agente E2E', description: 'Descrição com acentuação: ção, é, ü 🤖', system_prompt: 'Você é um assistente de teste.', provider: 'gemini', model: '', temperature: 0.7, top_p: 0.85, max_tokens: 4096 };
  const up = await colab.client.from('agents').update(payload).eq('id', agentId).select('*').maybeSingle();
  check('update de agente inexistente devolve vazio', !up.error && up.data === null, up.error?.message);
  const ins = await colab.client.from('agents').insert({ id: agentId, ...payload }).select('*').single();
  check('colaborador cria agente', !ins.error && ins.data?.user_id === colab.id, ins.error?.message);
  check('acentos e emoji preservados', ins.data?.description === payload.description);
  const key = await colab.client.rpc('definir_chave_agente', { p_agent_id: agentId, p_api_key: 'chave-de-teste' });
  check('grava chave própria via RPC', !key.error, key.error?.message);
  const sec = await colab.client.from('agent_secrets').select('*');
  check('navegador não lê agent_secrets', !!sec.error, sec.error?.message);
  await colab.client.rpc('definir_chave_agente', { p_agent_id: agentId, p_api_key: '' });

  // ── Chat do editor (base local + conhecimento global + data atual numa pergunta só)
  const gk = await api('/api/admin-global-assets', gestor.token, { method: 'POST', body: JSON.stringify({ type: 'knowledge', title: 'Cofre E2E', baseConhecimento: 'A senha do cofre é 9731.' }) });
  const gkId = gk.body.item?.id;
  check('gestor cria conhecimento global para o chat', gk.status === 200 && !!gkId, gk.body);
  r = await api('/api/llm', null, { method: 'POST', body: JSON.stringify({ agent: { id: agentId }, newMessage: 'oi' }) });
  check('/api/llm sem login: 401', r.status === 401);
  r = await api('/api/llm', colab.token, { method: 'POST', body: JSON.stringify({ agent: { id: agentId, name: 'Agente E2E', provider: 'gemini', model: '', systemPrompt: 'Responda de forma curta, em português.', temperature: 0.2, topP: 0.9, maxTokens: 1024, knowledgeBase: 'O código secreto é 4242.', globalKnowledgeIds: [gkId] }, history: [], newMessage: 'Responda os três itens: qual é o código secreto, qual é a senha do cofre e em que ano estamos?' }) });
  const temChave = r.status === 200;
  check('/api/llm logado chega até o provedor', r.status === 200 || (r.status === 400 && /Nenhuma chave de API/.test(r.body.error)), `${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
  if (temChave) {
    check('a IA usa a base de conhecimento local', /4242/.test(r.body.content || ''), r.body.content);
    check('a IA usa o conhecimento global', /9731/.test(r.body.content || ''), r.body.content);
    check('a IA sabe o ano atual', (r.body.content || '').includes(String(new Date().getFullYear())), r.body.content);
  }
  if (gkId) await api(`/api/admin-global-assets?type=knowledge&id=${gkId}`, gestor.token, { method: 'DELETE' });
  const conv = r.body.conversationId;
  check('/api/llm devolve conversationId', typeof conv === 'string' && conv.length === 36, conv);
  r = await api('/api/llm', colab.token, { method: 'POST', body: JSON.stringify({ agent: { id: agentId, name: 'Agente E2E', provider: 'gemini', model: '', systemPrompt: 'Responda apenas: OK' }, history: [], newMessage: 'segunda mensagem', conversationId: conv }) });
  check('segunda mensagem reutiliza a mesma conversa', r.body.conversationId === conv, r.body.conversationId);
  const sess = await admin.from('sessions').select('id, user_id, status, messages').eq('user_id', colab.id);
  check('uma única sessão para a conversa', sess.data?.length === 1, sess.data?.length);
  console.log(`      (provedor ${temChave ? 'respondeu' : 'sem chave de IA configurada no servidor'})`);

  // ── Histórico
  r = await api('/api/history', colab.token);
  check('histórico do colaborador só traz as próprias conversas', r.status === 200 && r.body.length === 1 && r.body[0].userEmail === colab.email, r.body.length);
  r = await api(`/api/history?id=${conv}`, colab.token);
  check('detalhe da conversa traz as mensagens', r.status === 200 && r.body.messages?.length >= 2 && r.body.messages[0].role === 'user', r.body.messages?.length);
  r = await api(`/api/history?id=${conv}`, semPerfil.token);
  check('detalhe da conversa bloqueado para quem não tem acesso', r.status === 403);
  r = await api('/api/history?tipo=requisicoes', colab.token);
  check('logs de requisições: uma linha por mensagem, só do próprio usuário', r.status === 200 && r.body.length === 2 && r.body.every((l: any) => l.userEmail === colab.email && l.input), r.body.length);
  r = await api('/api/history', gestor.token);
  check('gestor enxerga conversas de todos', r.status === 200 && r.body.some((l: any) => l.userEmail === colab.email));

  // ── API externa
  r = await api(`/api/chat/${agentId}`, null, { method: 'POST', body: JSON.stringify({ message: 'oi' }) });
  check('/api/chat em agente privado, anônimo: 403', r.status === 403, r.body);
  r = await api(`/api/chat/${agentId}`, colab.token, { method: 'POST', body: JSON.stringify({ message: 'oi' }) });
  check('/api/chat pelo dono chega até o provedor', r.status === 200 || r.status === 400, `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);

  // ── Ativos globais e sync
  r = await api('/api/admin-global-assets?type=knowledge', colab.token);
  check('colaborador lista conhecimentos globais', r.status === 200 && Array.isArray(r.body.items));
  r = await api('/api/admin-global-assets', colab.token, { method: 'POST', body: JSON.stringify({ type: 'knowledge', title: 'x' }) });
  check('colaborador não cria ativo global: 403', r.status === 403);
  r = await api('/api/admin-global-assets', gestor.token, { method: 'POST', body: JSON.stringify({ type: 'knowledge', title: 'Conhecimento E2E', baseConhecimento: 'conteúdo' }) });
  check('gestor cria ativo global', r.status === 200 && !!r.body.item?.id, r.body);
  if (r.body.item?.id) {
    const del = await api(`/api/admin-global-assets?type=knowledge&id=${r.body.item.id}`, gestor.token, { method: 'DELETE' });
    check('gestor apaga ativo global', del.status === 200);
  }
  r = await api('/api/sync-google', colab.token, { method: 'POST', body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data' }) });
  check('sync-google recusa URL que não é do Google: 400', r.status === 400, r.body);

  // ── Gestão de usuários
  r = await api('/api/admin-users', colab.token);
  check('colaborador não acessa gestão de usuários: 403', r.status === 403);
  const novoEmail = `e2e-novo-${stamp}@teste.tradestudio.dev`;
  r = await api('/api/admin-users', gestor.token, { method: 'POST', body: JSON.stringify({ email: novoEmail, role: 'colaborador', sector: 'comercial' }) });
  check('gestor concede acesso a e-mail novo e recebe senha provisória', r.status === 200 && typeof r.body.senhaProvisoria === 'string' && r.body.senhaProvisoria.length >= 12, r.status);
  const novoId = r.body.profile?.id;
  if (novoId) created.push(novoId);
  const novoClient = createClient(url, anon, { auth: { persistSession: false } });
  const novoLogin = await novoClient.auth.signInWithPassword({ email: novoEmail, password: r.body.senhaProvisoria });
  check('conta nova entra com a senha provisória e é obrigada a trocar', !novoLogin.error && novoLogin.data.user?.user_metadata?.must_change_password === true, novoLogin.error?.message);
  r = await api('/api/admin-users', gestor.token, { method: 'POST', body: JSON.stringify({ action: 'reset-password', id: novoId }) });
  check('gestor redefine a senha', r.status === 200 && typeof r.body.senhaProvisoria === 'string');
  r = await api('/api/admin-users', gestor.token, { method: 'POST', body: JSON.stringify({ email: novoEmail, role: 'admin', sector: 'comercial' }) });
  check('admin não concede cargo admin: 403', r.status === 403);
  // líder x admin (o bug antigo)
  await admin.from('profiles').update({ role: 'lider' }).eq('id', colab.id);
  r = await api('/api/admin-users', colab.token, { method: 'POST', body: JSON.stringify({ email: gestor.email, role: 'colaborador', sector: 'comercial' }) });
  check('líder NÃO rebaixa admin: 403', r.status === 403, r.body);
  r = await api(`/api/admin-users?id=${gestor.id}`, colab.token, { method: 'DELETE' });
  check('líder NÃO revoga admin: 403', r.status === 403, r.body);
  const { data: masterProfile } = await admin.from('profiles').select('id, email').eq('is_master', true).maybeSingle();
  if (masterProfile) {
    r = await api('/api/admin-users', gestor.token, { method: 'POST', body: JSON.stringify({ email: masterProfile.email, role: 'colaborador', sector: 'comercial' }) });
    check('admin NÃO rebaixa o Admin Master: 403', r.status === 403, r.body);
    r = await api('/api/admin-users', gestor.token, { method: 'POST', body: JSON.stringify({ action: 'reset-password', id: masterProfile.id }) });
    check('admin NÃO redefine a senha do Master: 403', r.status === 403, r.body);
  }
  r = await api(`/api/admin-users?id=${novoId}`, gestor.token, { method: 'DELETE' });
  check('gestor revoga acesso', r.status === 200);
} catch (err) {
  console.error('ERRO NO TESTE:', err);
  failures++;
} finally {
  // limpeza: tudo que o teste criou
  for (const id of created) {
    await admin.from('sessions').delete().eq('user_id', id);
    await admin.from('agents').delete().eq('user_id', id);
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
  await admin.from('tool_logs').delete().like('user_email', 'e2e-%@teste.tradestudio.dev');
  const left = await admin.auth.admin.listUsers({ perPage: 1000 });
  const sobras = left.data.users.filter(u => u.email?.endsWith('@teste.tradestudio.dev')).length;
  console.log(`limpeza: ${created.length} usuários de teste removidos, ${sobras} sobrando`);
}

console.log(failures === 0 ? '\nTUDO OK' : `\n${failures} FALHA(S)`);
process.exit(failures ? 1 : 0);
