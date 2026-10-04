import { createClient } from "@supabase/supabase-js";

// Cliente do navegador: só URL e anon key (públicas por natureza). O acesso
// aos dados é limitado pela RLS — ver supabase/migrations.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão definidas. Copie .env.example para .env.local e preencha."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
