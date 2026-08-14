import { DifyConfig, LogEntry, LogStatus, DifyResponse, DifyConversation, DifyMessage, ConversationSession } from "../types";
import { DEFAULT_DIFY_KEY, DEFAULT_DIFY_URL, DEFAULT_DIFY_USER } from "../constants";

const getHeaders = (apiKey: string) => ({
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
});

// Helper para transformar Dify Message em LogEntry
const mapDifyMessageToLog = (msg: DifyMessage, userId: string): LogEntry => {
  let latency = 0;
  // Tenta calcular latência baseada no thought ou estimativa
  if (msg.agent_thoughts && msg.agent_thoughts.length > 0) {
    const lastThought = msg.agent_thoughts[msg.agent_thoughts.length - 1];
    latency = (lastThought.created_at - msg.created_at) * 1000;
  } else {
     // Fallback: 300ms base + calculo por tamanho texto
     latency = Math.min(300 + (msg.answer.length * 5), 3000); 
  }

  return {
    id: msg.id,
    conversation_id: msg.conversation_id,
    created_at: msg.created_at * 1000,
    inputs: { query: msg.query, ...msg.inputs },
    outputs: msg.answer,
    status: LogStatus.SUCCESS,
    latency: Math.abs(latency),
    total_tokens: 0, 
    user_id: userId,
    error: undefined,
    retriever_resources: msg.retriever_resources || [],
    agent_thoughts: msg.agent_thoughts || [],
    feedback: msg.feedback
  };
};

export class DifyApiError extends Error {
  public statusCode: number;
  public url: string;
  public method: string;
  public apiKey: string;

  constructor(message: string, statusCode: number, url: string, method: string, apiKey: string) {
    super(message);
    this.name = "DifyApiError";
    this.statusCode = statusCode;
    this.url = url;
    this.method = method;
    this.apiKey = apiKey;
  }
}

// Helper para processar a string de IDs (Comma or Newline separated)
const parseUserIds = (rawString: string): string[] => {
  if (!rawString) return [];
  // Divide por vírgula OU quebra de linha (\n), remove espaços e vazios
  const list = rawString.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 0);
  // Remove duplicatas usando Set
  return [...new Set(list)];
};

// Busca uma sessão específica pelo ID (Bypassa a lista de conversas)
export const fetchSingleSession = async (config: DifyConfig, conversationId: string): Promise<ConversationSession | null> => {
  const apiKey = config.apiKey || DEFAULT_DIFY_KEY;
  const baseUrl = config.baseUrl || DEFAULT_DIFY_URL;
  const userId = config.userId || DEFAULT_DIFY_USER;

  // Pega apenas o primeiro user ID válido da lista para garantir compatibilidade da API
  const allUsers = parseUserIds(userId);
  const primaryUser = allUsers.length > 0 ? allUsers[0] : DEFAULT_DIFY_USER;

  const msgUrl = `${baseUrl}/messages?user=${encodeURIComponent(primaryUser)}&conversation_id=${conversationId.trim()}&limit=100`;
  
  try {
    const msgResponse = await fetch(msgUrl, { headers: getHeaders(apiKey) });
    
    if (!msgResponse.ok) {
      const errorText = await msgResponse.text();
      // Lança erro tipado para o DebugModal pegar
      throw new DifyApiError(errorText, msgResponse.status, msgUrl, 'GET', apiKey);
    }

    const msgData: DifyResponse<DifyMessage> = await msgResponse.json();

    if (!msgData.data || msgData.data.length === 0) {
      console.warn("Sessão encontrada mas sem mensagens.");
      return null;
    }

    // Mapear mensagens e ORDENAR POR TIMESTAMP (Antigas -> Novas)
    const messages = msgData.data
      .map(m => mapDifyMessageToLog(m, primaryUser))
      .sort((a, b) => a.created_at - b.created_at);

    const session: ConversationSession = {
      id: conversationId,
      name: `Conversa Importada (ID Manual)`,
      created_at: messages[0].created_at,
      updated_at: messages[messages.length - 1].created_at,
      user_id: primaryUser,
      status: 'imported',
      messages: messages
    };

    return session;

  } catch (error: any) {
    throw error; 
  }
};

export const fetchDifyLogs = async (config: DifyConfig | null): Promise<ConversationSession[]> => {
  const apiKey = config?.apiKey || DEFAULT_DIFY_KEY;
  const baseUrl = config?.baseUrl || DEFAULT_DIFY_URL;
  const rawUserId = config?.userId || DEFAULT_DIFY_USER;

  if (!apiKey) {
    console.warn("Sem API Key configurada.");
    return [];
  }

  // 1. Prepara lista de usuários (suporta CSV ou Quebra de linha e Remove duplicatas)
  const userIds = parseUserIds(rawUserId);
  
  try {
    // 2. Busca lista de conversas para TODOS os usuários em paralelo
    const conversationPromises = userIds.map(async (uid) => {
        const convUrl = `${baseUrl}/conversations?user=${encodeURIComponent(uid)}&limit=20`; // Limitamos 20 por user
        try {
            const res = await fetch(convUrl, { headers: getHeaders(apiKey) });
            if (!res.ok) {
                // Se falhar um usuário, loga mas não quebra tudo
                console.warn(`Erro ao buscar conversas para usuário ${uid}: ${res.status}`);
                return []; 
            }
            const data: DifyResponse<DifyConversation> = await res.json();
            // Injeta o user_id correto no objeto da conversa para uso posterior
            return data.data.map(c => ({ ...c, __temp_user_id: uid })) || [];
        } catch (err) {
            console.error(err);
            return [];
        }
    });

    const results = await Promise.all(conversationPromises);
    // Flat map para unir array de arrays em um único array de conversas
    const allConversations = results.flat();

    if (allConversations.length === 0) {
       // Se falhou tudo e temos apenas um usuário, tentamos lançar o erro original para debug
       if (userIds.length === 1) {
          const checkUrl = `${baseUrl}/conversations?user=${encodeURIComponent(userIds[0])}&limit=1`;
          const checkRes = await fetch(checkUrl, { headers: getHeaders(apiKey) });
          if (!checkRes.ok) {
             const txt = await checkRes.text();
             throw new DifyApiError(txt, checkRes.status, checkUrl, 'GET', apiKey);
          }
       }
       return [];
    }

    // 3. Busca mensagens para cada conversa encontrada
    // Nota: allConversations agora contém conversas de múltiplos usuários misturadas
    const sessionPromises = allConversations.map(async (conv: any) => {
      // Usa o user_id que injetamos acima, ou o padrão
      const currentConvUser = conv.__temp_user_id || userIds[0];
      
      const msgUrl = `${baseUrl}/messages?user=${encodeURIComponent(currentConvUser)}&conversation_id=${conv.id}&limit=100`;
      
      try {
        const msgResponse = await fetch(msgUrl, { headers: getHeaders(apiKey) });
        let messages: LogEntry[] = [];
        
        if (msgResponse.ok) {
          const msgData: DifyResponse<DifyMessage> = await msgResponse.json();
          messages = msgData.data.map(m => mapDifyMessageToLog(m, currentConvUser));
          // ORDENAR POR TIMESTAMP (Antigas -> Novas)
          messages.sort((a, b) => a.created_at - b.created_at); 
        }

        const session: ConversationSession = {
          id: conv.id,
          name: conv.name,
          created_at: conv.created_at * 1000,
          updated_at: conv.updated_at * 1000,
          user_id: currentConvUser,
          status: conv.status,
          messages: messages
        };
        return session;

      } catch (err) {
        console.warn(`Erro ao buscar mensagens da conversa ${conv.id}`, err);
        return null;
      }
    });

    const sessionsOrNull = await Promise.all(sessionPromises);
    const sessions = sessionsOrNull.filter((s): s is ConversationSession => s !== null);
    
    return sessions;

  } catch (error) {
    throw error;
  }
};