import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServiceRole } from '../lib/supabase.js';

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

/**
 * Call OpenAI LLM
 */
const callOpenAI = async (
  agent: any,
  history: any[],
  newMessage: string,
  apiKey: string
) => {
  try {
    if (!apiKey) {
      throw new Error('Chave de API OpenAI não configurada.');
    }

    const messages = [
      { role: 'system', content: agent?.systemPrompt || 'Você é um assistente prestativo.' },
      ...(history || []).map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: newMessage }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: agent?.model || 'gpt-4o-mini',
        messages,
        temperature: agent?.temperature || 0.7
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
      usage: { totalTokens }
    };
  } catch (e: any) {
    console.error('[llm.ts] OpenAI Error:', e);
    if (e.message?.includes('fetch')) {
      throw new Error('Erro de conexão com a OpenAI. Verifique o bloqueio de segurança (CSP) ou sua rede.');
    }
    throw e;
  }
};

/**
 * Call Gemini LLM with retry logic
 */
const callGemini = async (
  agent: any,
  history: any[],
  newMessage: string,
  apiKey: string
) => {
  const systemPrompt = agent?.systemPrompt || 'Você é um assistente prestativo.';

  const contents = [
    {
      role: 'user',
      parts: [{ text: `Instruções importantes:\n${systemPrompt}\n\nPor favor, siga estas instruções para todas as respostas.` }]
    },
    {
      role: 'model',
      parts: [{ text: 'Entendido! Vou seguir suas instruções.' }]
    },
    ...(history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: newMessage }] }
  ];

  // Try different Gemini models
  const configs = [
    { version: 'v1beta', model: 'gemini-2.0-flash-exp' },
    { version: 'v1beta', model: 'gemini-1.5-flash' },
    { version: 'v1', model: 'gemini-1.5-flash' },
    { version: 'v1', model: 'gemini-pro' },
    { version: 'v1beta', model: 'gemini-1.5-pro' }
  ];

  let responseData = null;
  let lastError = null;

  for (const config of configs) {
    try {
      console.log('[llm.ts] Trying Gemini config:', config);
      const url = `https://generativelanguage.googleapis.com/${config.version}/models/${config.model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: agent?.temperature || 0.7,
            maxOutputTokens: agent?.maxTokens || 2048
          }
        })
      });

      if (response.ok) {
        responseData = await response.json();
        console.log('[llm.ts] Success with Gemini config:', config);
        break;
      } else {
        const errorText = await response.text();
        console.warn('[llm.ts] Failed Gemini config:', config, response.status, errorText);
        lastError = { status: response.status, text: errorText };
      }
    } catch (err) {
      console.error('[llm.ts] Exception with Gemini config:', config, err);
      lastError = err;
    }
  }

  if (!responseData) {
    console.error('[llm.ts] All Gemini configs failed');
    throw new Error('Todas as configurações do Gemini falharam. Por favor, verifique sua chave API.');
  }

  return {
    content: responseData.candidates?.[0]?.content?.parts?.[0]?.text || 'IA não retornou texto.',
    usage: { totalTokens: responseData.usageMetadata?.totalTokenCount || 0 }
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[llm.ts] ------------------------------');
  console.log('[llm.ts] Request received! Method:', req.method);
  console.log('[llm.ts] supabaseServiceRole initialized:', !!supabaseServiceRole);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    console.log('[llm.ts] OPTIONS request, returning 200');
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    console.log('[llm.ts] GET health check');
    return res.status(200).json({
      status: 'ok',
      message: 'LLM API is working',
      supabase: !!supabaseServiceRole,
      supabaseUrl: process.env.JUNOS_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'NOT SET'
    });
  }
  
  if (req.method !== 'POST') {
    console.warn('[llm.ts] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[llm.ts] Parsing request body...');
    console.log('[llm.ts] Request body keys:', Object.keys(req.body || {}));
    const { agent, history, newMessage, clientPhone, userEmail, inputs } = req.body;
    const displayUserEmail = (userEmail === 'Público (Share)' || !userEmail) ? 'Sistema' : userEmail;
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agent?.id);

    console.log('[llm.ts] Agent config:', {
      name: agent?.name,
      model: agent?.model,
      provider: agent?.provider,
      id: agent?.id
    });
    console.log('[llm.ts] displayUserEmail:', displayUserEmail);
    console.log('[llm.ts] isValidUUID:', isValidUUID);

    // Get API keys from env
    const GEMINI_API_KEY = 
      process.env.JUNOS_GEMINI_API_KEY || 
      process.env.VITE_GEMINI_API_KEY || 
      process.env.GEMINI_API_KEY ||
      process.env.TRADESTUDIO_GEMINI_API_KEY ||
      process.env.TOKEN_GEMINI_API_KEY ||
      '';

    const OPENAI_API_KEY = 
      process.env.JUNOS_OPENAI_API_KEY || 
      process.env.VITE_OPENAI_API_KEY || 
      process.env.OPENAI_API_KEY ||
      '';

    console.log('[llm.ts] GEMINI_API_KEY present?', !!GEMINI_API_KEY);
    console.log('[llm.ts] OPENAI_API_KEY present?', !!OPENAI_API_KEY);

    // Prepare message with inputs if available
    let finalMessage = newMessage || 'Olá!';
    if (inputs) {
      console.log('[llm.ts] Including inputs in message:', inputs);
      finalMessage += '\n\n--- DADOS DO USUÁRIO (INPUTS) ---\n' + JSON.stringify(inputs, null, 2);
    }
    console.log('[llm.ts] Final message to LLM:', finalMessage);

    let response;

    // Determine which provider to use
    const provider = agent?.provider?.toLowerCase() || 'gemini';
    console.log('[llm.ts] Selected provider:', provider);

    if (provider === 'openai') {
      const apiKeyToUse = agent?.apiKey || OPENAI_API_KEY;
      console.log('[llm.ts] Using OpenAI with model:', agent?.model || 'gpt-4o-mini');
      response = await callOpenAI(agent, history, finalMessage, apiKeyToUse);
    } else {
      const apiKeyToUse = agent?.apiKey || GEMINI_API_KEY;
      console.log('[llm.ts] Using Gemini with model:', agent?.model || 'gemini-1.5-flash');
      response = await callGemini(agent, history, finalMessage, apiKeyToUse);
    }

    console.log('[llm.ts] LLM response received!');
    console.log('[llm.ts] Response preview:', response.content.substring(0, 50) + '...');

    // Log to Supabase (try, but don't fail)
    console.log('[llm.ts] Checking if supabaseServiceRole is truthy:', !!supabaseServiceRole);
    if (supabaseServiceRole) {
      console.log('[llm.ts] Proceeding to save tool_log...');
      try {
        const insertPayload = {
          agent_id: isValidUUID ? agent.id : null,
          user_email: displayUserEmail,
          tool_name: 'Execução Chat',
          webhook_url: 'N/A',
          payload: {
            message: finalMessage,
            agentName: agent?.name,
            agentModel: agent?.model,
            provider: agent?.provider
          },
          status: 'success',
          response: sanitizeForPostgres(response.content.substring(0, 2000)),
          phone: clientPhone || null,
          created_at: new Date().toISOString()
        };
        console.log('[llm.ts] Insert tool_log payload:', insertPayload);
        
        const insertResult = await supabaseServiceRole.from('tool_logs').insert(insertPayload);
        console.log('[llm.ts] Insert tool_log result:', insertResult);
        if (insertResult.error) {
          console.error('[llm.ts] Tool log insert ERROR:', insertResult.error);
        } else {
          console.log('[llm.ts] Tool log saved successfully');
        }
      } catch (logErr) {
        console.error('[llm.ts] Failed to save tool log (exception):', logErr);
      }

      // Now save to sessions table too!
      console.log('[llm.ts] Proceeding to save session...');
      try {
        // Prepare the messages array
        const newUserMessage = {
          id: generateUUID(),
          role: 'user',
          content: finalMessage,
          timestamp: Date.now()
        };
        const newAssistantMessage = {
          id: generateUUID(),
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          toolCalls: response.toolCalls
        };
        const updatedHistory = [...(history || []), newUserMessage, newAssistantMessage];
        const historyToSave = updatedHistory.slice(-20);

        // Prepare session data
        const sessionDataToSave: any = {
          agent_id: isValidUUID ? agent.id : null,
          agent_name: agent?.name || 'Agente Externo',
          agent_model: agent?.model || 'gemini-1.5-flash',
          messages: historyToSave,
          updated_at: new Date().toISOString()
        };

        console.log('[llm.ts] Insert session payload:', sessionDataToSave);

        // Insert into sessions table
        const { data: savedSession, error: sessionError } = await supabaseServiceRole
          .from('sessions')
          .insert(sessionDataToSave)
          .select('id')
          .single();

        if (sessionError) {
          console.error('[llm.ts] Failed to save session ERROR:', sessionError);
        } else {
          console.log('[llm.ts] Session saved successfully, ID:', savedSession?.id);
        }
      } catch (sessionErr) {
        console.error('[llm.ts] Exception saving session:', sessionErr);
      }
    } else {
      console.error('[llm.ts] supabaseServiceRole is falsy, skipping log and session saving!');
    }

    return res.status(200).json(response);

  } catch (err: any) {
    console.error('[llm.ts] Global error:', err);
    
    // Log error to Supabase
    if (supabaseServiceRole) {
      try {
        const { agent, userEmail } = req.body;
        const displayUserEmail = (userEmail === 'Público (Share)' || !userEmail) ? 'Sistema' : userEmail;
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agent?.id);
        
        await supabaseServiceRole.from('tool_logs').insert({
          agent_id: isValidUUID ? agent.id : null,
          user_email: displayUserEmail,
          tool_name: 'Execução Chat (Erro)',
          webhook_url: 'N/A',
          payload: {
            error: err.message,
            stack: err.stack,
            agentName: agent?.name || 'Agente Desconhecido',
            agentModel: agent?.model,
            agentId: agent?.id
          },
          status: 'error',
          response: `Erro: ${err.message}`,
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('[llm.ts] Failed to save error log:', logErr);
      }
    }

    return res.status(500).json({
      error: err.message || 'Erro interno do servidor',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
