import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseServiceRole } from './supabase.js';

function allowedOrigins(): string[] {
  const fromEnv = (process.env.APP_ORIGINS || '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const fromVercel = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
    .filter(Boolean)
    .map(host => `https://${host}`);
  return [...fromEnv, ...fromVercel, 'http://localhost:3000', 'http://localhost:5173'];
}

/**
 * Aplica CORS e os headers de segurança comuns. Devolve `true` quando a
 * requisição era um preflight e já foi respondida.
 */
export function preflight(req: VercelRequest, res: VercelResponse, methods: string): boolean {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export interface Caller {
  user: User;
  role: string | undefined;
  isMaster: boolean;
  /** Tem linha em `profiles` com cargo — mesma regra do AuthGate. */
  hasAccess: boolean;
  /** Admin Master, admin ou dev: enxerga e edita dados de todos. */
  isGestor: boolean;
}

/** Identifica quem chamou a partir do `Authorization: Bearer <token de sessão>`. */
export async function getCaller(req: VercelRequest): Promise<Caller | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  if (error || !user) return null;

  const { data: profile } = await supabaseServiceRole
    .from('profiles')
    .select('role, is_master')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  const isMaster = !!profile?.is_master;
  return {
    user,
    role,
    isMaster,
    hasAccess: !!profile && (!!role || isMaster),
    isGestor: isMaster || role === 'admin' || role === 'dev',
  };
}

/**
 * Exige um usuário logado e com acesso liberado. Responde 401/403 e devolve
 * `null` quando não há.
 */
export async function requireCaller(req: VercelRequest, res: VercelResponse): Promise<Caller | null> {
  const caller = await getCaller(req);
  if (!caller) {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    return null;
  }
  if (!caller.hasAccess) {
    res.status(403).json({ error: 'Seu usuário ainda não tem acesso liberado.' });
    return null;
  }
  return caller;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
