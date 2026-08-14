import { AgentConfig, CustomModel } from './types';

// Detect environment: browser uses import.meta.env, Node.js (Vercel functions) uses process.env
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

let GEMINI_API_KEY: string;
let OPENAI_API_KEY: string;
let DEFAULT_DIFY_KEY: string;
let DEFAULT_DIFY_URL: string;
let DEFAULT_DIFY_USER: string;
let KNOWN_AGENTS: any;

if (isNode) {
  // Node.js (Vercel functions)
  GEMINI_API_KEY = process.env.JUNOS_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.TRADESTUDIO_GEMINI_API_KEY || process.env.TOKEN_GEMINI_API_KEY || '';
  OPENAI_API_KEY = process.env.JUNOS_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  DEFAULT_DIFY_KEY = process.env.JUNOS_DIFY_API_KEY || process.env.VITE_DIFY_API_KEY || '';
  DEFAULT_DIFY_URL = process.env.JUNOS_DIFY_BASE_URL || process.env.VITE_DIFY_BASE_URL || 'https://api.dify.ai/v1';
  DEFAULT_DIFY_USER = process.env.JUNOS_DIFY_USER_ID || process.env.VITE_DIFY_USER_ID || 'default-user';

  KNOWN_AGENTS = {
    ESTELA: {
      name: 'Estela (SDR)',
      apiKey: process.env.JUNOS_DIFY_API_KEY_ESTELA || process.env.VITE_DIFY_API_KEY_ESTELA || '',
      avatar: '👩‍💼'
    },
    IARA: {
      name: 'Iara (Suporte)',
      apiKey: process.env.JUNOS_DIFY_API_KEY_IARA || process.env.VITE_DIFY_API_KEY_IARA || '',
      avatar: '🧠'
    }
  };
} else {
  // Browser/Vite
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - import.meta.env is available in Vite
  GEMINI_API_KEY = import.meta.env.JUNOS_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || import.meta.env.TRADESTUDIO_GEMINI_API_KEY || import.meta.env.TOKEN_GEMINI_API_KEY || '';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  OPENAI_API_KEY = import.meta.env.JUNOS_OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY || '';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  DEFAULT_DIFY_KEY = import.meta.env.JUNOS_DIFY_API_KEY || import.meta.env.VITE_DIFY_API_KEY || '';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  DEFAULT_DIFY_URL = import.meta.env.JUNOS_DIFY_BASE_URL || import.meta.env.VITE_DIFY_BASE_URL || 'https://api.dify.ai/v1';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  DEFAULT_DIFY_USER = import.meta.env.JUNOS_DIFY_USER_ID || import.meta.env.VITE_DIFY_USER_ID || 'default-user';

  KNOWN_AGENTS = {
    ESTELA: {
      name: 'Estela (SDR)',
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      apiKey: import.meta.env.JUNOS_DIFY_API_KEY_ESTELA || import.meta.env.VITE_DIFY_API_KEY_ESTELA || '',
      avatar: '👩‍💼'
    },
    IARA: {
      name: 'Iara (Suporte)',
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      apiKey: import.meta.env.JUNOS_DIFY_API_KEY_IARA || import.meta.env.VITE_DIFY_API_KEY_IARA || '',
      avatar: '🧠'
    }
  };
}

export {
  GEMINI_API_KEY,
  OPENAI_API_KEY,
  DEFAULT_DIFY_KEY,
  DEFAULT_DIFY_URL,
  DEFAULT_DIFY_USER,
  KNOWN_AGENTS
};

export const SYSTEM_MODELS: CustomModel[] = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Recomendado)', provider: 'gemini', context: '1M tokens' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Mais Inteligente)', provider: 'gemini', context: '2M tokens' },
  { id: 'gpt-4o', name: 'GPT-4o (OpenAI)', provider: 'openai', context: '128k context' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)', provider: 'openai', context: '128k context' }
];

export const DEFAULT_AGENT: AgentConfig = {
  id: 'new-agent',
  name: 'Novo Agente',
  description: '',
  avatar: '🤖',
  systemPrompt: 'Você é um assistente prestativo.',
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  preset: 'balanced',
  temperature: 0.7,
  topP: 0.85,
  presencePenalty: 0,
  frequencyPenalty: 0,
  maxTokens: 5000,
  responseFormat: 'text',
  tools: [],
  attachedFiles: [],
  created_at: Date.now()
};

export const PRESETS = [
  {
    id: 'sdr',
    name: 'SDR / Comercial',
    description: 'Focado em qualificação de leads e vendas.',
    systemPrompt: 'Você é um SDR focado em vendas...'
  },
  {
    id: 'support',
    name: 'Suporte Técnico',
    description: 'Especialista em resolver problemas.',
    systemPrompt: 'Você é um especialista em suporte...'
  }
];

export const ROLE_LABELS: Record<string, string> = {
    'colaborador': 'Colaborador',
    'co-lider': 'Co-Líder',
    'qualidade': 'Qualidade',
    'lider': 'Líder',
    'admin': 'Admin',
    'dev': 'Dev',
    'admin-master': 'Admin Master'
};

export const AGENT_SECTORS = [
    { id: 'comercial', name: 'Comercial / Vendas', color: '#EF4444' },
    { id: 'suporte', name: 'Suporte / CS', color: '#F59E0B' },
    { id: 'financeiro', name: 'Financeiro', color: '#10B981' },
    { id: 'rh', name: 'RH / Recrutamento', color: '#8B5CF6' },
    { id: 'marketing', name: 'Marketing', color: '#EC4899' },
    { id: 'operacoes', name: 'Operações', color: '#06B6D4' },
    { id: 'juridico', name: 'Jurídico', color: '#6366F1' },
    { id: 'tecnologia', name: 'Tecnologia / TEI', color: '#22C55E' },
    { id: 'diretoria', name: 'Diretoria / Estratégico', color: '#A855F7' }
];
