import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, supabaseServiceRole } from '../lib/supabase.js';
import { DEFAULT_AGENT } from '../constants.js';

// Helper to sanitize strings for Supabase
function sanitizeForPostgres(str: string): string {
  if (!str) return '';
  return str.replace(/\u0000/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "");
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface LLMResponse {
    content: string;
    usage?: { totalTokens: number };
    toolCalls?: any[];
}

/**
 * Sanitiza a mensagem do usuário para evitar Prompt Injection e vazamento de dados.
 */
const sanitizeUserMessage = (message: string): string => {
    const maliciousPatterns = [
        /ignore all previous instructions/gi,
        /ignore above/gi,
        /system prompt/gi,
        /sua chave de api/gi,
        /api key/gi,
        /reveal your instructions/gi,
        /esqueça as instruções/gi,
        /mostre seu prompt/gi
    ];

    let sanitized = message;
    maliciousPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, "[CONTEÚDO BLOQUEADO POR SEGURANÇA]");
    });

    return sanitized;
};

/**
 * Chamada para o Gemini com suporte a retry e backoff exponencial
 */
const callGeminiDirect = async (
    agent: any, 
    history: any[], 
    newMessage: string, 
    apiKey: string,
    retryCount = 0
): Promise<LLMResponse> => {
    const MAX_RETRIES = 5;
    const INITIAL_DELAY = 1500;

    try {
        const modelName = agent.model === 'gemini-3.1-flash-lite-preview' ? 'gemini-1.5-flash' : (agent.model || 'gemini-1.5-flash');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const contents = [];
        if (history && history.length > 0) {
            history.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    contents.push({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    });
                }
            });
        }

        contents.push({
            role: "user",
            parts: [{ text: newMessage }]
        });

        console.log(`[GEMINI] Tentativa ${retryCount + 1}/${MAX_RETRIES + 1} para o modelo ${modelName}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: agent.systemPrompt }]
                },
                contents: contents,
                generationConfig: { 
                    temperature: agent.temperature || 0.7,
                    maxOutputTokens: 4096 
                }
            })
        });

        const data = await response.json();
        const isQuotaError = response.status === 429 || (data.error?.message?.toLowerCase().includes('quota') || data.error?.message?.toLowerCase().includes('limit'));
        const isTemporaryError = response.status >= 500;

        if (isQuotaError || isTemporaryError) {
            if (retryCount < MAX_RETRIES) {
                const jitter = Math.random() * 1000;
                const delay = (INITIAL_DELAY * Math.pow(2, retryCount)) + jitter;
                console.warn(`[GEMINI] ${isQuotaError ? 'Limite de cota' : 'Erro temporário'} atingido. Retentando em ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return callGeminiDirect(agent, history, newMessage, apiKey, retryCount + 1);
            }
            const error = new Error(data.error?.message || "O Gemini está sobrecarregado. Por favor, tente novamente em instantes.");
            (error as any).status = 429;
            throw error;
        }

        if (!response.ok) {
            throw new Error(data.error?.message || `Erro na API do Google (${response.status})`);
        }

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro: IA não retornou texto.";
        const totalTokens = data.usageMetadata?.totalTokenCount || 0;
        console.log(`[GEMINI RAW] Sucesso! Tokens: ${totalTokens}`);

        return {
            content,
            toolCalls: undefined,
            usage: { totalTokens }
        };
    } catch (error: any) {
        if (error.status) throw error;
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
            console.error("[GEMINI] Erro de Conexão:", error);
            if (retryCount < MAX_RETRIES) {
                const delay = INITIAL_DELAY * Math.pow(2, retryCount);
                console.warn(`[GEMINI] Retentando em ${delay}ms devido a erro de rede...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return callGeminiDirect(agent, history, newMessage, apiKey, retryCount + 1);
            }
            throw new Error("Erro de conexão com o servidor da IA. Verifique sua internet ou se o serviço está disponível.");
        }
        console.error("Gemini Error:", error);
        throw error;
    }
};

const callOpenAI = async (
    agent: any, 
    history: any[], 
    newMessage: string,
    apiKey: string
): Promise<LLMResponse> => {
    try {
        if (!apiKey) {
            throw new Error("Chave de API OpenAI não configurada.");
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${apiKey}` 
            },
            body: JSON.stringify({
                model: agent.model || "gpt-4o-mini",
                messages: [
                    { role: "system", content: agent.systemPrompt },
                    ...history.map(m => ({ role: m.role, content: m.content })),
                    { role: "user", content: newMessage }
                ],
                temperature: agent.temperature || 0.7,
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Erro OpenAI (${response.status})`);
        }

        const data = await response.json();
        const totalTokens = data.usage?.total_tokens || 0;
        
        return { 
            content: data.choices[0].message.content, 
            toolCalls: undefined, 
            usage: { totalTokens } 
        };
    } catch (e: any) { 
        console.error("OpenAI Error:", e);
        if (e.message?.includes('fetch')) {
            throw new Error("Erro de conexão com a OpenAI. Verifique o bloqueio de segurança (CSP) ou sua rede.");
        }
        throw e; 
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedOrigins = [
        'https://tradestudio-ai-studio.vercel.app',
        'https://tradestars-ai-studio.vercel.app',
        'https://tradestudio.com.br',
        'http://localhost:5173'
    ];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', 'https://tradestudio-ai-studio.vercel.app');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let agentId: any = null;
    let user: any = null;
    let agentData: any = null;

    try {
    console.log('[API chat.ts] Request received!');
    console.log('[API chat.ts] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[API chat.ts] Query params:', JSON.stringify(req.query, null, 2));
    console.log('[API chat.ts] Body:', JSON.stringify(req.body, null, 2));
    
    // Check if supabaseServiceRole is initialized okay
    console.log('[API chat.ts] Checking supabaseServiceRole initialization...');
    
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > 1000000) {
      return res.status(413).json({ error: 'Payload muito grande.' });
    }

    agentId = req.query.agentId || req.body?.agentId;
    console.log('[API chat.ts] agentId received:', agentId);
    
    let conversationId = req.body?.conversation_id || req.query.conversationId;
    const { message, inputs } = req.body || {};
    let { history = [] } = req.body || {};

    if (!agentId) {
      return res.status(400).json({ error: 'agentId é obrigatório.' });
    }

    // Try both agents and global_agents tables
    console.log('[API chat.ts] Trying to fetch from agents table first...');
    let dbError: any;
    ({ data: agentData, error: dbError } = await supabaseServiceRole.from('agents').select('*').eq('id', agentId).maybeSingle());
    console.log('[API chat.ts] agents table result:', { agentData, dbError });
    
    if (!agentData) {
      console.log('[API chat.ts] Agent not found in agents table, trying global_agents...');
      const { data: globalAgentData, error: globalDbError } = await supabaseServiceRole.from('global_agents').select('*').eq('id', agentId).maybeSingle();
      console.log('[API chat.ts] global_agents table result:', { globalAgentData, globalDbError });
      
      if (globalAgentData) {
        agentData = globalAgentData;
      }
      if (!agentData) {
        console.error(`[API] Erro ao buscar agente ${agentId}:`, dbError || globalDbError);
        return res.status(404).json({ error: 'Agente não encontrado.' });
      }
    } else {
      console.log('[API chat.ts] Agent found! Agent data:', agentData);
    }

        const authHeader = req.headers.authorization;
        const apiKeyHeader = req.headers['x-api-key'];
        let isExternalCall = false;
        if (authHeader) {
            try {
                const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
                if (!authError && authUser && authUser.role === 'authenticated') {
                    user = authUser;
                }
            } catch (e) {
                console.error('[SECURITY] Erro na validação de token Supabase.');
            }
        }
        if (apiKeyHeader) {
            isExternalCall = true;
        }

        // Check access
        let hasAccess = false;
        if (agentData.is_public) {
            hasAccess = true; // Public agents are accessible to anyone
        } else if (user && user.id === agentData.user_id) {
            hasAccess = true; // User owns the private agent
        } else if (isExternalCall && agentData.api_key && agentData.api_key === apiKeyHeader) {
            hasAccess = true; // Valid API key for the private agent
        }

        if (!hasAccess) {
            console.warn(`[SECURITY] Acesso negado ao agente ${agentId}.`);
            return res.status(403).json({ 
                error: 'Acesso negado.', 
                message: 'Você não tem permissão para acessar este agente.' 
            });
        }

        // Prepare user message with inputs included
        let userMessage = message || "Analise os dados e gere a resposta";
        
        // If inputs are provided, add them to the user message
        let inputsContext = "";
        if (inputs) {
            console.log('[API chat.ts] Including inputs in prompt:', inputs);
            inputsContext = "\n\n--- DADOS DO USUÁRIO (INPUTS) ---\n" + JSON.stringify(inputs, null, 2);
        }
        
        const finalMessage = userMessage + inputsContext;
        console.log('[API chat.ts] Final message to LLM:', finalMessage);
        
        if (!finalMessage) {
            return res.status(400).json({ error: 'message (ou inputs) é obrigatório.' });
        }

        if (conversationId === 'null' || conversationId === 'undefined' || !conversationId) {
            conversationId = null;
        }

        const agent: any = {
            ...DEFAULT_AGENT,
            id: agentData.id,
            name: agentData.name || '',
            description: agentData.description || '',
            avatar: agentData.avatar || '🤖',
            provider: agentData.provider || 'gemini',
            model: agentData.model || 'gemini-1.5-flash',
            systemPrompt: agentData.system_prompt || '',
            temperature: agentData.temperature || 0.7,
            topP: agentData.top_p || 0.85,
            maxTokens: agentData.max_tokens || 2048,
            created_at: agentData.created_at ? new Date(agentData.created_at).getTime() : Date.now(),
            knowledgeBase: agentData.knowledge_base || '',
            googleDocId: agentData.google_doc_id || '',
            syncInterval: agentData.sync_interval || 24,
            lastSyncAt: agentData.last_sync_at,
            cachedContent: agentData.cached_content,
            attachedFiles: agentData.attached_files || [],
            globalKnowledgeIds: agentData.global_knowledge_ids || [],
            apiKey: agentData.api_key || '',
            isPublic: agentData.is_public ?? true,
            tools: agentData.tools || []
        };

        const sanitizedMessage = sanitizeUserMessage(finalMessage);
        const GEMINI_API_KEY = process.env.JUNOS_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
        const OPENAI_API_KEY = process.env.JUNOS_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';

        let response: LLMResponse;
        
        let knowledgeContext = "";
        if (agent.knowledgeBase && agent.knowledgeBase.trim().length > 0) {
            knowledgeContext += "\n\n[BASE DE CONHECIMENTO ESTÁTICA]:\n" + agent.knowledgeBase;
        }

        if (agent.googleDocId && agent.googleDocId.trim().length > 0) {
            let docText = agent.cachedContent || "";
            const now = new Date();
            const lastSync = agent.lastSyncAt ? new Date(agent.lastSyncAt) : new Date(0);
            const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
            const syncInterval = agent.syncInterval || 24;

            if (!agent.cachedContent || hoursSinceSync >= syncInterval) {
                try {
                    console.log(`[KNOWLEDGE] Sincronizando Google Docs (Intervalo: ${syncInterval}h): ${agent.googleDocId}`);
                    const docUrls = agent.googleDocId.split(',').filter(id => id.trim());
                    let concatenatedContent = '';
                    for (const urlOrId of docUrls) {
                        const cleanId = urlOrId.includes('/d/') ? urlOrId.match(/\/d\/(.*?)(\/|$|#|\?)/)?.[1] || urlOrId : urlOrId;
                        const isSheet = urlOrId.toLowerCase().includes('spreadsheets') || urlOrId.toLowerCase().includes('planilhas');
                        let apiUrl: string;
                        if (isSheet) {
                            apiUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=text/csv`;
                        } else {
                            apiUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=text/plain`;
                        }
                        const headers: Record<string, string> = {};
                        const token = (user as any)?.provider_token;
                        if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                        }
                        const docResponse = await fetch(apiUrl, { headers });
                        if (docResponse.ok) {
                            const text = await docResponse.text();
                            if (text && text.length > 5) {
                                concatenatedContent += `\n\n--- INÍCIO DO DOCUMENTO (${isSheet ? 'PLANILHA' : 'TEXTO'}): ${cleanId} ---\n\n` + text + `\n\n--- FIM DO DOCUMENTO: ${cleanId} ---`;
                            }
                        }
                    }
                    if (concatenatedContent) {
                        docText = concatenatedContent;
                        const updateData = { cached_content: docText, last_sync_at: now.toISOString() };
                        const { error } = await supabaseServiceRole.from('agents').update(updateData).eq('id', agentId);
                        if (error) await supabaseServiceRole.from('global_agents').update(updateData).eq('id', agentId);
                    }
                } catch (docErr) {
                    console.error(`[KNOWLEDGE] Erro ao sincronizar Google Docs:`, docErr);
                }
            }
            
            if (docText) {
                knowledgeContext += "\n\n[BASE DE CONHECIMENTO DINÂMICA (GOOGLE DOCS)]:\n" + docText;
            }
        }

        if (agent.globalKnowledgeIds && agent.globalKnowledgeIds.length > 0) {
            try {
                console.log(`[KNOWLEDGE] Buscando ${agent.globalKnowledgeIds.length} blocos de conhecimento global...`);
                const { data: globalKData } = await supabaseServiceRole.from('global_knowledge').select('*').in('id', agent.globalKnowledgeIds);
                if (globalKData && globalKData.length > 0) {
                    for (const k of globalKData) {
                        let kContent = k.content;
                        if (k.google_doc_id) {
                            const now = new Date();
                            const lastSync = k.last_sync_at ? new Date(k.last_sync_at) : new Date(0);
                            const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
                            const syncInterval = k.sync_interval || 24;
                            if (!k.cached_content || hoursSinceSync >= syncInterval) {
                                try {
                                    console.log(`[KNOWLEDGE] Sincronizando Docs Globais: ${k.title}`);
                                    const docUrls = k.google_doc_id.split(',').filter((id: string) => id.trim());
                                    let concatenatedContent = '';
                                    for (const urlOrId of docUrls) {
                                        const cleanId = urlOrId.includes('/d/') ? urlOrId.match(/\/d\/(.*?)(\/|$|#|\?)/)?.[1] || urlOrId : urlOrId;
                                        const isSheet = urlOrId.toLowerCase().includes('spreadsheets') || urlOrId.toLowerCase().includes('planilhas');
                                        let apiUrl: string;
                                        if (isSheet) {
                                            apiUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=text/csv`;
                                        } else {
                                            apiUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=text/plain`;
                                        }
                                        const headers: Record<string, string> = {};
                                        const token = (user as any)?.provider_token;
                                        if (token) {
                                            headers['Authorization'] = `Bearer ${token}`;
                                        }
                                        const docResponse = await fetch(apiUrl, { headers });
                                        if (docResponse.ok) {
                                            const text = await docResponse.text();
                                            if (text && text.length > 5) {
                                                concatenatedContent += `\n\n--- INÍCIO DO DOCUMENTO (${isSheet ? 'PLANILHA' : 'TEXTO'}): ${cleanId} ---\n\n` + text + `\n\n--- FIM DO DOCUMENTO: ${cleanId} ---`;
                                            }
                                        } else {
                                            console.error(`[KNOWLEDGE] Erro ao acessar doc ${cleanId}:`, await docResponse.text());
                                        }
                                    }
                                    if (concatenatedContent) {
                                        kContent = concatenatedContent;
                                        await supabaseServiceRole.from('global_knowledge').update({ cached_content: concatenatedContent, last_sync_at: now.toISOString() }).eq('id', k.id);
                                    }
                                } catch (err) {
                                    console.error(`[KNOWLEDGE] Erro ao sincronizar Docs Globais:`, err);
                                }
                            } else {
                                kContent = k.cached_content || k.content;
                            }
                        }
                        knowledgeContext += `\n\n[CONHECIMENTO COMPARTILHADO: ${k.title}]\n${kContent}`;
                    }
                }
            } catch (err) {
                console.error(`[KNOWLEDGE] Erro ao buscar conhecimentos globais:`, err);
            }
        }

        if (agent.attachedFiles && agent.attachedFiles.length > 0) {
            knowledgeContext += "\n\n[DOCUMENTOS ANEXADOS]:";
            agent.attachedFiles.forEach((file: any) => {
                knowledgeContext += `\n--- INÍCIO DO ARQUIVO: ${file.name} ---\n${file.content}\n--- FIM DO ARQUIVO: ${file.name} ---`;
            });
        }

        if (knowledgeContext.length > 0) {
            knowledgeContext += "\n\nUse as informações das Bases de Conhecimento acima para responder às perguntas do usuário com precisão. Se a informação não estiver na base, responda com base no seu conhecimento geral, mas priorize sempre a base fornecida.";
        }

        let finalSystemPrompt = agent.systemPrompt;
        if (history.length > 0) {
            finalSystemPrompt = `[IMPORTANTE: CONVERSA EM ANDAMENTO] 
Você já iniciou esta conversa e já se apresentou nas mensagens anteriores. 
ESTÁ PROIBIDO:
1. Usar saudações (Olá, Oi, Bom dia, etc).
2. Se apresentar (Eu sou..., Meu nome é...).
3. Perguntar "Como posso ajudar?".
AJA COMO SE estivéssemos no meio de uma frase. Responda DIRETAMENTE e APENAS ao que foi perguntado agora.
${agent.systemPrompt}`;
        }

        const systemPromptWithContext = knowledgeContext + "\n\n" + finalSystemPrompt;
        const agentWithTools = { ...agent, systemPrompt: systemPromptWithContext };

        if (agent.provider === 'gemini') {
            const apiKeyToUse = agent.apiKey || GEMINI_API_KEY;
            response = await callGeminiDirect(agentWithTools, history, sanitizedMessage, apiKeyToUse);
        } else {
            const apiKeyToUse = agent.apiKey || OPENAI_API_KEY;
            response = await callOpenAI(agentWithTools, history, sanitizedMessage, apiKeyToUse);
        }

        const newUserMessage = {
            id: generateUUID(),
            role: 'user',
            content: sanitizedMessage,
            timestamp: Date.now()
        };
        const newAssistantMessage = {
            id: generateUUID(),
            role: 'assistant',
            content: response.content,
            timestamp: Date.now(),
            toolCalls: response.toolCalls
        };
        const updatedHistory = [...history, newUserMessage, newAssistantMessage];
        const historyToSave = updatedHistory.slice(-20);

        const sessionDataToSave: any = {
            agent_id: agentId,
            agent_name: agentData.name || 'Agente Externo',
            agent_model: agentData.model || 'gemini-1.5-flash',
            messages: historyToSave,
            updated_at: new Date().toISOString()
        };

        if (conversationId) {
            sessionDataToSave.id = conversationId;
        }

        // Save log to tool_logs table
        if (supabaseServiceRole) {
            try {
                const displayUserEmail = user ? user.email : 'Sistema';
                const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
                await supabaseServiceRole.from('tool_logs').insert({
                    agent_id: isValidUUID ? agentId : null,
                    user_email: displayUserEmail,
                    tool_name: 'Execução Chat',
                    webhook_url: 'N/A',
                    payload: {
                        message: sanitizedMessage,
                        agentName: agentData.name,
                        agentModel: agentData.model,
                        provider: agent.provider
                    },
                    status: 'success',
                    response: sanitizeForPostgres(response.content.substring(0, 2000)),
                    phone: null,
                    created_at: new Date().toISOString()
                });
                console.log('[API chat.ts] Log saved successfully to tool_logs');
            } catch (logErr) {
                console.error('[API chat.ts] Failed to save log to tool_logs:', logErr);
            }
        }

        let finalConversationId = conversationId;
        const { data: savedSession, error: sessionError } = await supabaseServiceRole.from('sessions').upsert(sessionDataToSave, { onConflict: 'id' }).select('id').single();
        if (!sessionError && savedSession) {
            finalConversationId = savedSession.id;
        }

        return res.status(200).json({
            ...response,
            conversation_id: finalConversationId,
            message_id: newAssistantMessage.id
        });

    } catch (err: any) {
        console.error('[API] Erro:', err);

        // Log error to tool_logs table
        if (supabaseServiceRole) {
            try {
                const displayUserEmail = user ? user.email : 'Sistema';
                const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
                await supabaseServiceRole.from('tool_logs').insert({
                    agent_id: isValidUUID ? agentId : null,
                    user_email: displayUserEmail,
                    tool_name: 'Execução Chat (Erro)',
                    webhook_url: 'N/A',
                    payload: {
                        error: err.message,
                        stack: err.stack,
                        agentName: agentData?.name || 'Agente Desconhecido',
                        agentModel: agentData?.model,
                        agentId: agentId
                    },
                    status: 'error',
                    response: `Erro: ${err.message}`,
                    phone: null,
                    created_at: new Date().toISOString()
                });
                console.log('[API chat.ts] Error log saved successfully to tool_logs');
            } catch (logErr) {
                console.error('[API chat.ts] Failed to save error log to tool_logs:', logErr);
            }
        }

        const statusCode = err.status || 500;
        let displayMessage = err.message;
        if (statusCode === 500) {
            displayMessage = "Ocorreu um erro ao processar sua solicitação no motor de IA. Verifique as configurações do agente ou tente novamente mais tarde.";
        }

        return res.status(statusCode).json({ 
            error: statusCode === 429 ? 'Limite de cota excedido' : 'Erro interno', 
            message: displayMessage
        });
    }
}
