import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomInt } from 'node:crypto';
import { supabaseServiceRole } from './_lib/supabase.js';
import { preflight, requireCaller } from './_lib/http.js';
import { ROLE_LABELS, type UserRole } from '../constants.js';

/**
 * Gestão real de usuários (tabela `profiles` + `auth.users`).
 * Precisa da service role key porque `auth.admin.*` e a leitura de profiles
 * de outras pessoas (fora do escopo da RLS do usuário logado) só funcionam no
 * servidor.
 *
 * O cadastro público é desligado no Supabase: a conta nasce aqui, quando um
 * gestor concede acesso a um e-mail novo. A resposta traz uma senha
 * provisória (mostrada uma única vez) e o usuário é obrigado a trocá-la no
 * primeiro login (ver AuthGate.tsx).
 */

// Sem caracteres ambíguos (0/O, 1/l/I), porque a senha é repassada à mão.
const SENHA_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function gerarSenhaProvisoria(): string {
  return Array.from({ length: 14 }, () => SENHA_ALFABETO[randomInt(SENHA_ALFABETO.length)]).join('');
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, 'GET, POST, DELETE')) return;

  const caller = await requireCaller(req, res);
  if (!caller) return;

  const podeGerenciar = caller.isGestor || caller.role === 'lider';
  if (!podeGerenciar) {
    return res.status(403).json({ error: 'Você não tem permissão para gerenciar usuários.' });
  }

  try {
    if (req.method === 'GET') {
      const [{ data: authUsers, error: authUsersError }, { data: profiles, error: profilesError }] = await Promise.all([
        supabaseServiceRole.auth.admin.listUsers({ perPage: 1000 }),
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

    if (req.method === 'POST' && req.body?.action === 'reset-password') {
      const targetId = req.body.id;
      if (!targetId) {
        return res.status(400).json({ error: 'Campo obrigatório ausente: id.' });
      }
      if (targetId === caller.user.id) {
        return res.status(403).json({ error: 'Você não pode redefinir a própria senha por aqui.' });
      }

      const { data: targetProfile } = await supabaseServiceRole
        .from('profiles')
        .select('role, is_master')
        .eq('id', targetId)
        .maybeSingle();
      if (!targetProfile || targetProfile.is_master) {
        return res.status(403).json({ error: 'Não é possível redefinir a senha deste usuário.' });
      }
      // Mesma régua de conceder/revogar: só redefine a senha de quem está abaixo.
      const roleAllowed = rolesQueCallerPodeConceder(caller.role, caller.isMaster);
      if (!roleAllowed.includes(targetProfile.role)) {
        return res.status(403).json({ error: 'Você não tem permissão para redefinir a senha deste usuário.' });
      }

      const senhaProvisoria = gerarSenhaProvisoria();
      const { error: updateError } = await supabaseServiceRole.auth.admin.updateUserById(targetId, {
        password: senhaProvisoria,
        user_metadata: { must_change_password: true },
      });
      if (updateError) throw updateError;

      return res.status(200).json({ senhaProvisoria });
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

      const { data: authUsers, error: authUsersError } = await supabaseServiceRole.auth.admin.listUsers({ perPage: 1000 });
      if (authUsersError) throw authUsersError;
      let targetUser = authUsers?.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase());
      let senhaProvisoria: string | undefined;
      if (!targetUser) {
        senhaProvisoria = gerarSenhaProvisoria();
        const { data: created, error: createError } = await supabaseServiceRole.auth.admin.createUser({
          email: String(email).trim().toLowerCase(),
          password: senhaProvisoria,
          email_confirm: true,
          user_metadata: { must_change_password: true },
        });
        if (createError) throw createError;
        targetUser = created.user;
      }

      // Ninguém pode alterar o próprio cargo por aqui, mesmo que a role acima
      // já permita o cargo solicitado — impede auto-promoção (ex.: dev -> admin).
      if (targetUser.id === caller.user.id) {
        return res.status(403).json({ error: 'Você não pode alterar seu próprio cargo.' });
      }

      // Conceder um cargo sobrescreve o perfil atual do alvo. Sem checar o
      // cargo que ele já tem, um Líder conseguia "conceder" colaborador a um
      // Admin (ou ao Master) e, na prática, rebaixá-lo.
      const { data: targetProfile } = await supabaseServiceRole
        .from('profiles')
        .select('role, is_master')
        .eq('id', targetUser.id)
        .maybeSingle();
      if (targetProfile?.is_master) {
        return res.status(403).json({ error: 'O cargo do Admin Master não pode ser alterado.' });
      }
      if (targetProfile?.role && !roleAllowed.includes(targetProfile.role)) {
        return res.status(403).json({ error: 'Você não tem permissão para alterar o cargo deste usuário.' });
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

      return res.status(200).json({ profile: updated, senhaProvisoria });
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

      // Só dá para revogar um cargo que o próprio caller poderia conceder —
      // sem isso, o poder de remover seria maior que o de conceder (um Líder
      // removendo um Admin, um Dev removendo outro Dev).
      const roleAllowed = rolesQueCallerPodeConceder(caller.role, caller.isMaster);
      if (targetProfile?.role && !roleAllowed.includes(targetProfile.role)) {
        return res.status(403).json({ error: 'Você não tem permissão para revogar o acesso deste usuário.' });
      }

      const { error: deleteError } = await supabaseServiceRole.from('profiles').delete().eq('id', targetId);
      if (deleteError) throw deleteError;

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[api/admin-users] Erro:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
