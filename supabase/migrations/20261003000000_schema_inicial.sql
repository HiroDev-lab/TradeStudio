-- TradeStudio — schema inicial completo.
--
-- O projeto Supabase original foi apagado e o repositório só tinha duas
-- migrations parciais. Este arquivo recria o banco inteiro do zero, com as
-- tabelas que o app realmente usa, RLS em todas e o gatilho que cria o perfil
-- do Admin Master no primeiro login.
--
-- Regra geral de acesso:
--   * o navegador (anon key + sessão do usuário) só lê/escreve `agents` e lê o
--     próprio `profiles`, sempre limitado por RLS;
--   * todo o resto (usuários, ativos globais, sessões, logs, chaves de API)
--     passa pelas funções de api/*.ts, que usam a service role key.

create schema if not exists private;

-- ─── Configurações internas (não expostas pela API) ──────────────────────────
create table private.app_settings (
  key text primary key,
  value text not null
);

-- ─── Perfis ──────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text check (role in ('colaborador', 'co-lider', 'qualidade', 'lider', 'admin', 'dev')),
  sectors text[] not null default '{}',
  is_master boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Usadas pelas policies. SECURITY DEFINER para poderem consultar `profiles`
-- sem cair na RLS da própria tabela.
create function private.tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;

create function private.eh_gestor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and (is_master or role in ('admin', 'dev'))
  );
$$;

-- Primeiro login do e-mail configurado como master já nasce com perfil.
-- Os demais usuários entram sem perfil e ficam bloqueados até um gestor
-- conceder acesso em "Gestão de Usuários".
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) = lower((select value from private.app_settings where key = 'master_email')) then
    insert into public.profiles (id, email, role, is_master)
    values (new.id, new.email, 'admin', true)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Define (ou troca) o Admin Master. Rodar no SQL Editor:
--   select public.configurar_admin_master('email@exemplo.com');
-- Funciona antes ou depois de a pessoa ter feito o primeiro login.
create function public.configurar_admin_master(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.app_settings (key, value)
  values ('master_email', lower(p_email))
  on conflict (key) do update set value = excluded.value;

  update public.profiles set is_master = false where is_master;

  insert into public.profiles (id, email, role, is_master)
  select id, email, 'admin', true from auth.users where lower(email) = lower(p_email)
  on conflict (id) do update set role = 'admin', is_master = true;
end;
$$;

-- ─── Agentes ─────────────────────────────────────────────────────────────────
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  description text not null default '',
  avatar text not null default '🤖',
  provider text not null default 'gemini' check (provider in ('gemini', 'openai', 'openrouter')),
  model text not null default '',
  custom_models jsonb not null default '[]',
  has_api_key boolean not null default false,
  system_prompt text not null default '',
  temperature double precision not null default 0.7,
  top_p double precision not null default 0.85,
  max_tokens integer not null default 2048,
  is_reasoning boolean not null default false,
  knowledge_base text not null default '',
  google_doc_id text not null default '',
  sync_interval integer not null default 24,
  last_sync_at timestamptz,
  cached_content text,
  attached_files jsonb not null default '[]',
  global_knowledge_ids uuid[] not null default '{}',
  global_request_ids uuid[] not null default '{}',
  tools jsonb not null default '[]',
  is_public boolean not null default false,
  sectors text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agents_user_id_idx on public.agents (user_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function private.set_updated_at();

-- Chave de API própria do agente. Fica em tabela separada, sem nenhuma policy,
-- para nunca chegar ao navegador: o cliente grava via definir_chave_agente()
-- e só o servidor (service role) lê.
create table public.agent_secrets (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  api_key text not null,
  updated_at timestamptz not null default now()
);

create function public.definir_chave_agente(p_agent_id uuid, p_api_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.agents
    where id = p_agent_id
      and (user_id = (select auth.uid()) or private.eh_gestor())
  ) then
    raise exception 'Agente não encontrado ou sem permissão.' using errcode = '42501';
  end if;

  if coalesce(trim(p_api_key), '') = '' then
    delete from public.agent_secrets where agent_id = p_agent_id;
    update public.agents set has_api_key = false where id = p_agent_id;
  else
    insert into public.agent_secrets (agent_id, api_key)
    values (p_agent_id, trim(p_api_key))
    on conflict (agent_id) do update set api_key = excluded.api_key, updated_at = now();
    update public.agents set has_api_key = true where id = p_agent_id;
  end if;
end;
$$;

-- ─── Ativos globais ──────────────────────────────────────────────────────────
create table public.global_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  content text not null default '',
  google_doc_id text not null default '',
  sync_interval integer not null default 24,
  last_sync_at timestamptz,
  cached_content text,
  sectors text[] not null default '{}',
  is_public boolean not null default true,
  allowed_roles text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.global_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  breve_descritivo text not null default '',
  emoji text not null default '',
  url text not null default '',
  metodo text not null default 'GET',
  json_schema text not null default '',
  setores text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Conversas e logs ────────────────────────────────────────────────────────
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid,
  agent_name text,
  agent_model text,
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  origem text not null default 'app',
  status text not null default 'success',
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_updated_at_idx on public.sessions (updated_at desc);
create index sessions_user_id_idx on public.sessions (user_id);

create table public.tool_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid,
  user_email text,
  tool_name text,
  webhook_url text,
  payload jsonb,
  status text not null default 'success',
  response text,
  phone text,
  created_at timestamptz not null default now()
);

create index tool_logs_created_at_idx on public.tool_logs (created_at desc);

-- ─── Permissões ──────────────────────────────────────────────────────────────
alter table private.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.agent_secrets enable row level security;
alter table public.global_knowledge enable row level security;
alter table public.global_requests enable row level security;
alter table public.sessions enable row level security;
alter table public.tool_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant usage on schema private to authenticated, service_role;
grant execute on function private.tem_acesso() to authenticated;
grant execute on function private.eh_gestor() to authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
grant select on public.global_knowledge, public.global_requests to authenticated;
grant execute on function public.definir_chave_agente(uuid, text) to authenticated;

grant all on all tables in schema public to service_role;
grant execute on function public.configurar_admin_master(text) to service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy agents_select on public.agents
  for select to authenticated
  using (
    private.tem_acesso()
    and (user_id = (select auth.uid()) or is_public or private.eh_gestor())
  );

create policy agents_insert on public.agents
  for insert to authenticated
  with check (private.tem_acesso() and user_id = (select auth.uid()));

create policy agents_update on public.agents
  for update to authenticated
  using (private.tem_acesso() and (user_id = (select auth.uid()) or private.eh_gestor()))
  with check (private.tem_acesso() and (user_id = (select auth.uid()) or private.eh_gestor()));

create policy agents_delete on public.agents
  for delete to authenticated
  using (private.tem_acesso() and (user_id = (select auth.uid()) or private.eh_gestor()));

create policy global_knowledge_select on public.global_knowledge
  for select to authenticated
  using (private.tem_acesso());

create policy global_requests_select on public.global_requests
  for select to authenticated
  using (private.tem_acesso());

-- agent_secrets, sessions, tool_logs e app_settings ficam sem policy de
-- propósito: só a service role (que ignora RLS) acessa.
