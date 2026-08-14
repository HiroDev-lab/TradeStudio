-- Ativos Globais (Conhecimento e Requisições) — hoje vivem só no localStorage do
-- navegador de quem cadastrou; esta migration cria as tabelas reais no Supabase
-- para que fiquem compartilhadas entre todos os usuários, como já é o caso dos
-- agentes (tabela `agents`) e dos perfis (tabela `profiles`).
--
-- Rode este arquivo no SQL Editor do Supabase (Dashboard > SQL Editor > New query)
-- do projeto usado por JUNOS_SUPABASE_URL/.env.local.

-- NOTA (pós-execução): `global_knowledge` já existia em produção com um
-- schema diferente deste (title, description, content, is_public,
-- allowed_roles, google_doc_id, sync_interval, cached_content, last_sync_at,
-- sectors) — já usado de verdade por api/chat.ts para montar o contexto dos
-- agentes. O `create table if not exists` abaixo foi por isso um no-op (não
-- criou nem alterou nada) e a tabela real seguiu intacta. O código do app
-- (api/admin/global-assets.ts) mapeia para essas colunas reais, não para as
-- listadas aqui. Mantido apenas como registro do que foi de fato executado.
create table if not exists global_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  breve_descritivo text not null default '',
  base_conhecimento text not null default '',
  google_docs_id text not null default '',
  setores text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists global_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  breve_descritivo text not null default '',
  emoji text not null default '',
  url text not null default '',
  metodo text not null default 'GET',
  json_schema text not null default '',
  setores text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table global_knowledge enable row level security;
alter table global_requests enable row level security;

-- Leitura liberada para qualquer usuário autenticado (agentes de qualquer setor
-- precisam listar os ativos globais na tela de edição). Escrita só acontece via
-- api/admin/global-assets.ts, que usa a service role key (ignora RLS) e já
-- valida no próprio endpoint quem pode criar/excluir — por isso não há policy
-- de insert/update/delete aqui: só o backend privilegiado escreve.
create policy "global_knowledge_select_authenticated"
  on global_knowledge for select
  to authenticated
  using (true);

create policy "global_requests_select_authenticated"
  on global_requests for select
  to authenticated
  using (true);
