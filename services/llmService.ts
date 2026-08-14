import { AgentConfig, ChatMessage } from "../types.js";

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

export const runAgent = async (
  agent: AgentConfig, 
  history: ChatMessage[], 
  newMessage: string,
  clientPhone?: string | null,
  inputs?: Record<string, any>,
  userEmail?: string | null,
  googleToken?: string | null
): Promise<LLMResponse> => {
  console.log("[DEBUG runAgent] Starting with agent:", agent);
  console.log("[DEBUG runAgent] agent.provider:", agent.provider);
  console.log("[DEBUG runAgent] agent.model:", agent.model);
  console.log("[DEBUG runAgent] auth token present:", !!(window as any).supabase?.auth?.session?.access_token);
  const sanitizedMessage = sanitizeUserMessage(newMessage);
  
  const requestBody = {
      agent,
      history,
      newMessage: sanitizedMessage,
      clientPhone,
      inputs,
      userEmail,
      googleToken
  };
  
  console.log("[DEBUG runAgent] Request body:", requestBody);
  
  try {
    const accessToken = (window as any).supabase?.auth?.session?.access_token;
    const headers: any = { "Content-Type": "application/json" };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const response = await fetch("/api/llm", {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody)
    });
    
    console.log("[DEBUG runAgent] Response status:", response.status);
    console.log("[DEBUG runAgent] Response ok:", response.ok);
    
    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
        console.error("[DEBUG runAgent] Error response text:", errorText);
        const errorData = JSON.parse(errorText);
        console.error("[DEBUG runAgent] Error data:", errorData);
        throw new Error(errorData.error || `Erro (${response.status}): ${errorText}`);
      } catch (e) {
        console.error("[DEBUG runAgent] Could not parse JSON error:", e);
        throw new Error(`Erro (${response.status}): ${errorText || "Erro ao comunicar com servidor de IA"}`);
      }
    }
    
    const result = await response.json();
    console.log("[DEBUG runAgent] Success! Result:", result);
    return result;
  } catch (error) {
    console.error("[DEBUG runAgent] Full error:", error);
    throw error;
  }
};
