-- `profiles` estava sem RLS restritiva: até a anon key (embutida no bundle do
-- navegador, pública por natureza) conseguia listar e-mails e cargos de todo
-- mundo com um simples `select * from profiles`. Nenhum código do app
-- depende disso — a única leitura direta do client é AuthGate.tsx checando o
-- PRÓPRIO perfil (`eq('id', session.user.id)`); toda leitura/escrita
-- administrativa (Gestão de Usuários, Ativos Globais) já passa por
-- api/admin/*.ts usando a service role key, que ignora RLS de qualquer forma.
--
-- Rode este arquivo no SQL Editor do Supabase (Dashboard > SQL Editor > New
-- query), no mesmo projeto das migrations anteriores.

-- Remove todas as policies existentes em `profiles` (nomes desconhecidos /
-- possivelmente permissivas demais) antes de recriar as corretas.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

alter table public.profiles enable row level security;

-- Cada usuário autenticado só pode ler o PRÓPRIO perfil (usado por
-- AuthGate.tsx para decidir se libera ou bloqueia o acesso ao app).
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Sem policy de insert/update/delete: toda escrita em `profiles` acontece via
-- api/admin/users.ts (service role, ignora RLS) — nenhum client escreve
-- diretamente na tabela.
