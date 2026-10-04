
// Carrega .env.local (mesmo arquivo que o Vite usa no navegador) para dentro
// de process.env ANTES de importar qualquer módulo que leia chaves de API
// (ex.: api/_lib/supabase.ts, api/_lib/llm.ts), já que rodamos este servidor via `tsx`,
// que — ao contrário do Vite — não lê .env automaticamente.
//
// Importante: em ESM, TODOS os imports estáticos de um módulo são resolvidos
// e executados antes do corpo do próprio módulo rodar — não na ordem em que
// aparecem no arquivo. Por isso os handlers de api/*.ts (que carregam
// api/_lib/supabase.ts e leem chaves de API) são importados dinamicamente dentro
// de startServer(), depois do dotenv.config() já ter rodado.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback para .env, se existir

import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.disable('x-powered-by');

    // CSP fica desligada aqui: em dev o Vite injeta scripts inline e usa
    // websocket para o HMR. Em produção quem define a CSP é o vercel.json.
    app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

    app.use(express.json({ limit: '2mb' }));

    // --- Funções serverless reais (as mesmas que rodam na Vercel em produção,
    // ver vercel.json). Importadas dinamicamente para garantir que o
    // dotenv.config() acima já rodou antes delas lerem process.env. ---
    const [
        { default: llmHandler },
        { default: chatHandler },
        { default: historyHandler },
        { default: syncGoogleHandler },
        { default: adminUsersHandler },
        { default: adminGlobalAssetsHandler },
    ] = await Promise.all([
        import('./api/llm.js'),
        import('./api/chat.js'),
        import('./api/history.js'),
        import('./api/sync-google.js'),
        import('./api/admin-users.js'),
        import('./api/admin-global-assets.js'),
    ]);

    app.all('/api/llm', (req, res) => llmHandler(req as any, res as any));
    app.all('/api/history', (req, res) => historyHandler(req as any, res as any));
    app.all('/api/sync-google', (req, res) => syncGoogleHandler(req as any, res as any));
    app.all('/api/admin-users', (req, res) => adminUsersHandler(req as any, res as any));
    app.all('/api/admin-global-assets', (req, res) => adminGlobalAssetsHandler(req as any, res as any));

    // Lead API externa: /api/chat/:agentId → equivalente ao rewrite do vercel.json
    // (source: /api/chat/:agentId, destination: /api/chat?agentId=:agentId)
    app.all('/api/chat/:agentId', (req, res) => {
        req.query.agentId = req.params.agentId;
        return chatHandler(req as any, res as any);
    });
    app.all('/api/chat', (req, res) => chatHandler(req as any, res as any));

    // --- VITE MIDDLEWARE ---
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Gestor de Agentes rodando em http://localhost:${PORT}`);
        console.log(`📡 Lead API disponível em POST /api/chat/:agentId`);
    });
}

startServer();
