# TradeStudio — Gestor de Agentes de IA

Painel para criar, configurar e acompanhar agentes de IA (OpenRouter, Gemini e OpenAI): persona, modelo, base de conhecimento, usuários com cargos e histórico de conversas.

## Como é montado

| Parte | Onde | Observação |
|---|---|---|
| Interface | `src/` (React + Vite) | Arquivo principal: `src/app/App.tsx` |
| Servidor | `api/` (funções serverless da Vercel) | Código comum em `api/_lib/` |
| Banco e login | Supabase (Postgres + Auth por e-mail e senha) | Schema em `supabase/migrations/` |

Endpoints:

| Rota | Para quê | Quem pode chamar |
|---|---|---|
| `POST /api/llm` | Chat de teste do editor | Usuário logado com acesso |
| `POST /api/chat/:agentId` | API externa (n8n, sites) | Agente público, dono/gestor ou `x-api-key` do agente |
| `GET /api/history` | Histórico de conversas | Logado (gestor vê tudo, os demais só o próprio) |
| `/api/admin-users` | Gestão de usuários e cargos | Master, admin, dev, líder |
| `/api/admin-global-assets` | Conhecimentos e requisições globais | Leitura: logado. Escrita: master, admin, dev, líder |
| `POST /api/sync-google` | Importa texto de Google Docs/Planilhas | Usuário logado com acesso |

## Rodando na sua máquina

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha (as chaves ficam em Supabase > Project Settings > API).
3. `npm run dev` e abra http://localhost:3000

`npm run lint` checa os tipos e `npm run build` gera a versão de produção em `dist/`.

`npx tsx scripts/e2e.mts https://URL-DO-SITE` roda o teste de ponta a ponta contra um ambiente no ar: cria usuários descartáveis, exercita login, agentes, chat, histórico e gestão de usuários, e apaga tudo no fim.

## Montando o ambiente do zero

### 1. Supabase
1. Crie um projeto.
2. Aplique o schema: `npx supabase link --project-ref <ref>` e `npx supabase db push` (ou cole `supabase/migrations/20261003000000_schema_inicial.sql` no SQL Editor).
3. Em Authentication > Sign In / Providers, desligue "Allow new users to sign up" (as contas são criadas pelos gestores dentro do sistema) e deixe a senha mínima em 8.
4. Em Authentication > URL Configuration, ponha a URL do site em "Site URL" e adicione `http://localhost:3000` em "Redirect URLs".
5. Crie o Admin Master: em Authentication > Users > Add user, cadastre o e-mail e a senha dele; depois, no SQL Editor:
   ```sql
   select public.configurar_admin_master('email@exemplo.com');
   ```
   O mesmo comando troca o Admin Master depois.

### 2. Vercel
1. Importe o repositório (framework Vite, saída `dist`).
2. Cadastre as variáveis de `.env.example` em Settings > Environment Variables. Basta uma chave de IA (`OPENROUTER_API_KEY`, `GEMINI_API_KEY` ou `OPENAI_API_KEY`).
3. Faça o deploy.

### 3. Login com Google (opcional)
1. No Google Cloud Console (APIs e serviços > Credenciais), crie um "ID do cliente OAuth" do tipo aplicativo da Web com a URI de redirecionamento `https://<ref>.supabase.co/auth/v1/callback`.
2. Em Supabase > Authentication > Providers, ative o Google com o Client ID e o Client Secret.
3. Na Vercel, defina `VITE_GOOGLE_LOGIN=true` e refaça o deploy. Quem entrar pelo Google ainda precisa que um gestor conceda o acesso.

## Como o acesso funciona

- Ninguém se cadastra sozinho. Em **Gestão de Usuários**, um gestor concede acesso a um e-mail; se a conta não existe, ela é criada e o gestor recebe uma **senha provisória** para repassar. No primeiro login a pessoa é obrigada a escolher uma senha nova.
- Esqueceu a senha: o gestor usa **Redefinir senha** no usuário e repassa a nova senha provisória. (Não há envio de e-mail; o Admin Master redefine a própria senha pelo painel do Supabase.)
- Cargos: colaborador, co-líder, qualidade, líder, admin, dev, e o Admin Master (único). Cada um só concede, altera, revoga ou redefine a senha de quem está abaixo.
- O navegador só acessa a tabela `agents` (limitado por RLS: cada um vê os próprios agentes e os globais) e o próprio perfil. Todo o resto passa pelo servidor.
- A chave de API própria de um agente fica em `agent_secrets` e nunca volta para o navegador. Sem chave própria, o agente usa a chave padrão da empresa. Agente sem modelo escolhido usa o provedor e o modelo padrão (ver `.env.example`).

## Ainda não implementado

- As requisições (webhooks) são cadastradas e salvas no agente, mas a IA ainda não as executa (tool calling).
- Os links de compartilhamento, iframe e widget da aba Geral apontam para rotas públicas (`/chat/:id`, `/embed/:id`, `/widget.js`) que ainda não existem.
- PDF anexado não tem o texto extraído (só `.docx`).
- A base de conhecimento entra inteira no prompt (sem busca por similaridade/RAG).
- Provedor Claude direto pela Anthropic (hoje os modelos Claude só são alcançáveis via OpenRouter).
- Tela para o próprio usuário trocar a senha fora do primeiro login.

Interface original no Figma: https://www.figma.com/design/tFdpks6l1YyJL1qCoe97Tr/IA-Agent-Management-Frontend
