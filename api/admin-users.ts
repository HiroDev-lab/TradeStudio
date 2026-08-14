import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, supabaseServiceRole } from '../lib/supabase.js';
import { ROLE_LABELS } from '../constants.js';
import type { UserRole } from '../types.js';

/**
 * Gestão real de usuários (tabela `profiles` + `auth.users`).
 * Precisa da service role key porque `auth.admin.listUsers()` e a leitura de
 * profiles de outras pessoas (fora do escopo da RLS do usuário logado) só
 * funcionam no servidor.
 */

const allowedOrigins = [
  'https://tradestudio-ai-studio.vercel.app',
  'https://tradestars-ai-studio.vercel.app',
  'https://tradestudio.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
];

const ROLES_A_LIDER_PODE_CONCEDER: UserRole[] = ['colaborador', 'co-lider'];
// 'admin' e 'dev' podem gerenciar a hierarquia abaixo deles, mas nunca conceder
// 'admin' ou 'dev' — isso é reservado ao Admin Master. Sem essa restrição, um
// usuário com cargo 'dev' conseguia se auto-promover (ou promover terceiros)
// a 'admin' via este mesmo endpoint.
const ROLES_ADMIN_DEV_PODEM_CONCEDER: UserRole[] = ['colaborador', 'co-lider', 'qualidade', 'lider'];

function rolesQueCallerPodeConceder(callerRole: string | undefined, callerIsMaster: boolean): UserRole[] {
  if (callerIsMaster) {
    return ['colaborador', 'co-lider', 'qualidade', 'lider', 'admin', 'dev'];
  }
  if (callerRole === 'admin' || callerRole === 'dev') {
    return ROLES_ADMIN_DEV_PODEM_CONCEDER;
  }
  if (callerRole === 'lider') {
    return ROLES_A_LIDER_PODE_CONCEDER;
  }
  return [];
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

  const podeGerenciar = caller.isMaster || ['admin', 'dev', 'lider'].includes(caller.role || '');
  if (!podeGerenciar) {
    return res.status(403).json({ error: 'Você não tem permissão para gerenciar usuários.' });
  }

  try {
    if (req.method === 'GET') {
      const [{ data: authUsers, error: authUsersError }, { data: profiles, error: profilesError }] = await Promise.all([
        supabaseServiceRole.auth.admin.listUsers(),
        supabaseServiceRole.from('profiles').select('*'),
      ]);
      if (authUsersError) throw authUsersError;
      if (profilesError) throw profilesError;

      const profileById = new Map((profiles || []).map(p => [p.id, p]));
      const users = (authUsers?.users || []).map(u => {
        const profile = profileById.get(u.id);
        return {
          id: u.id,
          email: u.email,
          createdAt: u.created_at,
          role: profile?.role || null,
          sectors: profile?.sectors || [],
          isMaster: !!profile?.is_master,
          createdBy: profile?.created_by || null,
          hasAccess: !!profile,
        };
      });

      return res.status(200).json({ users, roleLabels: ROLE_LABELS });
    }

    if (req.method === 'POST') {
      const { email, role, sector } = req.body || {};
      if (!email || !role) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes: email e role.' });
      }

      const roleAllowed = rolesQueCallerPodeConceder(caller.role, caller.isMaster);
      if (!roleAllowed.includes(role)) {
        return res.status(403).json({ error: 'Você não tem permissão para conceder este cargo.' });
      }

      const { data: authUsers, error: authUsersError } = await supabaseServiceRole.auth.admin.listUsers();
      if (authUsersError) throw authUsersError;
      const targetUser = authUsers?.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase());
      if (!targetUser) {
        return res.status(404).json({
          error: 'Esse e-mail ainda não fez login com o Google no sistema. Peça para a pessoa entrar uma vez antes de conceder acesso.',
        });
      }

      // Ninguém pode alterar o próprio cargo por aqui, mesmo que a role acima
      // já permita o cargo solicitado — impede auto-promoção (ex.: dev -> admin).
      if (targetUser.id === caller.user.id) {
        return res.status(403).json({ error: 'Você não pode alterar seu próprio cargo.' });
      }

      const { data: updated, error: upsertError } = await supabaseServiceRole
        .from('profiles')
        .upsert({
          id: targetUser.id,
          email: targetUser.email,
          role,
          sectors: sector ? [sector] : [],
          is_master: false,
          created_by: caller.user.id,
        })
        .select()
        .single();
      if (upsertError) throw upsertError;

      return res.status(200).json({ profile: updated });
    }

    if (req.method === 'DELETE') {
      const targetId = (req.query.id as string) || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: 'Campo obrigatório ausente: id.' });
      }

      const { data: targetProfile } = await supabaseServiceRole
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (targetProfile?.is_master) {
        return res.status(403).json({ error: 'O Admin Master não pode ter o acesso removido.' });
      }

      if (targetId === caller.user.id) {
        return res.status(403).json({ error: 'Você não pode revogar seu próprio acesso.' });
      }

      // Só o Admin Master pode revogar acesso de outro 'admin' ou 'dev' —
      // sem isso, um 'dev' ou 'admin' conseguia remover concorrentes de mesmo
      // nível mesmo sem poder concedê-lo (poder destrutivo maior que o de concessão).
      if (!caller.isMaster && (targetProfile?.role === 'admin' || targetProfile?.role === 'dev')) {
        return res.status(403).json({ error: 'Apenas o Admin Master pode revogar acesso de Admin ou Dev.' });
      }

      const { error: deleteError } = await supabaseServiceRole.from('profiles').delete().eq('id', targetId);
      if (deleteError) throw deleteError;

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[API] Erro em /api/admin/users:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
