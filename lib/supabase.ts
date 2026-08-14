import { createClient } from '@supabase/supabase-js';

// Detect environment: browser uses import.meta.env, Node.js (Vercel functions) uses process.env
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

let supabaseUrl: string;
let supabaseAnonKey: string;
let supabaseServiceKey: string;
let isProduction: boolean;

if (isNode) {
  // Node.js (Vercel functions)
  supabaseUrl = process.env.JUNOS_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  supabaseAnonKey = process.env.JUNOS_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  supabaseServiceKey = process.env.JUNOS_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || '';
  isProduction = process.env.NODE_ENV === 'production';
  console.log('[SUPABASE] Node.js environment detected');
} else {
  // Browser/Vite
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - import.meta.env is available in Vite
  supabaseUrl = import.meta.env.JUNOS_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  supabaseAnonKey = import.meta.env.JUNOS_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  supabaseServiceKey = ''; // Service key not available in browser
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  isProduction = import.meta.env.PROD;
  console.log('[SUPABASE] Browser/Vite environment detected');
}

// Log de depuração (seguro, não mostra a chave inteira)
console.log('[SUPABASE] Inicializando cliente...', { 
    url: supabaseUrl ? 'Configurada' : 'AUSENTE',
    anonKey: supabaseAnonKey ? 'Configurada (starts with ' + (supabaseAnonKey.length > 5 ? supabaseAnonKey.substring(0, 5) : '') + ')' : 'AUSENTE',
    serviceKey: isNode ? (supabaseServiceKey ? 'Configurada' : 'AUSENTE') : 'N/A (Browser)',
    usingPrefix: isNode 
      ? (process.env.JUNOS_SUPABASE_URL ? 'JUNOS' : (process.env.VITE_SUPABASE_URL ? 'VITE' : 'NENHUM'))
      : (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          import.meta.env.JUNOS_SUPABASE_URL ? 'JUNOS' : (
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              import.meta.env.VITE_SUPABASE_URL ? 'VITE' : 'NENHUM'
          )
        )
});

if (!supabaseUrl || !supabaseAnonKey) {
  if (isProduction) {
    console.error('Supabase credentials missing in production! Please check Vercel environment variables.');
  } else {
    console.warn('Supabase credentials missing! Using empty strings for development.');
  }
}

// Inicializa o cliente Supabase de forma simples e direta (para browser/cliente)
export const supabase = createClient(
    supabaseUrl, 
    supabaseAnonKey
);

// Inicializa cliente com chave de serviço (para server-side APIs, ignora RLS)
console.log('[lib/supabase] Initializing supabaseServiceRole...');
console.log('[lib/supabase] isNode:', isNode);
console.log('[lib/supabase] supabaseUrl present:', !!supabaseUrl);
console.log('[lib/supabase] supabaseServiceKey present:', !!supabaseServiceKey);
console.log('[lib/supabase] Using service key?', !!(isNode && supabaseServiceKey));

export const supabaseServiceRole = isNode
  ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : supabase;
