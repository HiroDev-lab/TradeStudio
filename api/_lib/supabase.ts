import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    'Variáveis do Supabase ausentes no servidor. Defina VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY (ver .env.example).'
  );
}

const serverOnly = { auth: { autoRefreshToken: false, persistSession: false } };

// Usado só para validar o token de sessão que o navegador envia.
export const supabase = createClient(url, anonKey, serverOnly);

// Ignora RLS. Nunca importar fora de api/.
export const supabaseServiceRole = createClient(url, serviceKey, serverOnly);
