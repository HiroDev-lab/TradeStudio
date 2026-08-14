
export type LLMProvider = 'gemini' | 'openai';

export type UserRole = 'colaborador' | 'co-lider' | 'qualidade' | 'lider' | 'admin' | 'dev' | 'admin-master';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  sectors?: string[]; // Restaurado para plural e array conforme memória do projeto
  is_master?: boolean;
  created_by?: string; // ID do usuário que criou este perfil
  created_at: string;
}

export interface CustomModel {
  id: string;
  name: string;
  provider: LLMProvider;
  context: string;
}

export type PresetMode = 'creative' | 'balanced' | 'precise' | 'custom';

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  parameters: string; // JSON Schema string
  webhookUrl?: string; // URL para disparar a requisição (N8N, Zapier, API Própria)
  method?: 'GET' | 'POST';
}

export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // O conteúdo de texto extraído para o LLM
  created_at: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  avatar: string;
  sector?: string; // Adicionado: Setor do agente (compatibilidade)
  sectors?: string[]; // Adicionado: Múltiplos setores
  
  // Model Config
  provider: LLMProvider;
  model: string; 
  isReasoning?: boolean; 
  
  // Prompting & Knowledge
  systemPrompt: string;
  knowledgeBase?: string; // Conteúdo estático/local
  googleDocId?: string;   // Novo: ID do Google Doc para sync em tempo real
  syncInterval?: number;  // Intervalo em horas (3, 6, 9, 12, 24, 168)
  lastSyncAt?: string;    // Data da última sincronização
  cachedContent?: string; // Conteúdo cacheado do Google Doc
  
  // Main Parameters
  preset: PresetMode;
  temperature: number;
  topP: number;
  presencePenalty: number; 
  frequencyPenalty: number; 
  
  // Advanced Parameters
  maxTokens: number;
  responseFormat: 'text' | 'json';
  jsonSchema?: string; 
  
  tools: AgentTool[];
  attachedFiles?: AttachedFile[]; // Adicionado: Arquivos anexados localmente
  globalKnowledgeIds?: string[]; // Adicionado: Referências a conhecimentos globais
  apiKey?: string; // Adicionado: Chave de API pessoal do usuário para este agente
  isPublic?: boolean; // Adicionado: Define se o agente pode ser acessado via embed
  created_at: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string; // Se for tool, o content é o resultado da função
  timestamp: number;
  latency?: number;
  tokens?: number;
  toolCalls?: any[]; // Detalhes da chamada da ferramenta (se role=assistant)
  toolCallId?: string; // ID de referência para resposta da ferramenta (se role=tool)
  error?: boolean; 
}

// Estrutura para Logs agrupados por conversa
export interface SavedSession {
  id: string;
  agentId: string;
  agentName: string;
  agentModel: string;
  startTime: number;
  lastUpdate: number;
  messages: ChatMessage[];
  status: 'active' | 'completed' | 'error';
  summary?: string; // Um preview da conversa
}

// Mantido para compatibilidade com DifyService, mas a UI principal usará SavedSession
export interface RunLog {
    id: string;
    agent_name: string;
    model: string;
    input: string;
    output: string;
    latency: number;
    status: 'success' | 'error';
    timestamp: number;
}

// --- Dify Types ---
export enum LogStatus { SUCCESS = 'success', ERROR = 'error' }
export interface RetrieverResource { position: number; dataset_id: string; dataset_name: string; document_id: string; document_name: string; segment_id: string; score: number; content: string; }
export interface AgentThought { id: string; chain_id: string; message_id: string; position: number; thought: string; tool: string; tool_input: string; created_at: number; observation: string; files?: any[]; }
export interface LogEntry { id: string; conversation_id: string; created_at: number; inputs: any; outputs: string; status: LogStatus; latency: number; total_tokens: number; user_id: string; error?: string; retriever_resources?: RetrieverResource[]; agent_thoughts?: AgentThought[]; feedback?: any; }
export interface AnalysisResult { summary: string; sentiment: string; suggestions: string; }
export interface DifyConfig { apiKey: string; baseUrl: string; userId: string; agentName?: string; }
export interface DifyResponse<T> { data: T[]; has_more: boolean; limit: number; total?: number; }
export interface DifyMessage { id: string; conversation_id: string; inputs: any; query: string; answer: string; message_files: any[]; feedback: any; retriever_resources: RetrieverResource[]; created_at: number; agent_thoughts: AgentThought[]; }

// --- Global Assets Types ---
export interface GlobalKnowledge {
  id: string;
  title: string;
  description: string;
  content: string;
  google_doc_id?: string; // Adicionado: Suporte a Google Docs
  sync_interval?: number; // Adicionado
  last_sync_at?: string;  // Adicionado
  cached_content?: string; // Adicionado
  sectors?: string[]; // Alterado: Múltiplos setores
  is_public: boolean;
  allowed_roles?: string[]; // Adicionado: Cargos liberados (admin, user, etc)
  created_at: number;
}

export interface GlobalTool {
  id: string;
  name: string;
  description: string;
  parameters: string;
  webhook_url: string;
  method: 'GET' | 'POST';
  sectors?: string[]; // Alterado: Múltiplos setores
  is_public: boolean;
  allowed_roles?: string[]; // Adicionado: Cargos liberados (admin, user, etc)
  created_at: number;
}

export interface GlobalAgent {
    id: string;
    name: string;
    description: string;
    avatar: string;
    sector?: string; // Alterado: Único setor para consistência (compatibilidade)
    sectors?: string[]; // Adicionado: Múltiplos setores
    provider: LLMProvider;
    model: string;
    is_reasoning?: boolean;
    system_prompt: string;
    temperature: number;
    top_p: number;
    max_tokens: number;
    is_public: boolean;
    allowed_roles?: string[];
    tools: any[];
    attached_files?: AttachedFile[]; // Adicionado
    knowledge_base?: string;
    google_doc_id?: string;
    sync_interval?: number; // Adicionado
    last_sync_at?: string;  // Adicionado
    cached_content?: string; // Adicionado
    global_knowledge_ids?: string[];
    api_key?: string; // Adicionado: Chave de API do LLM
    created_at: string;
}

export interface DifyConversation { id: string; name: string; inputs: any; status: string; introduction: string; created_at: number; updated_at: number; }
export interface ConversationSession { id: string; name: string; created_at: number; updated_at: number; user_id: string; status: string; messages: LogEntry[]; __temp_user_id?: string; }
