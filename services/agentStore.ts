
import { AgentConfig, RunLog, CustomModel, SavedSession } from '../types.js';
import { DEFAULT_AGENT } from '../constants.js';

const SESSIONS_KEY = 'tradestudio_sessions_v1';
const LOGS_KEY = 'tradestudio_logs_v1';
const CUSTOM_MODELS_KEY = 'tradestudio_custom_models_v1';

// --- AGENTS (REMOVIDO: USANDO EXCLUSIVAMENTE SUPABASE) ---

// --- SESSIONS (LOGS POR CONVERSA) ---
export const getSessions = (): SavedSession[] => {
    const saved = localStorage.getItem(SESSIONS_KEY);
    return saved ? JSON.parse(saved) : [];
};

export const saveSession = (session: SavedSession) => {
    const sessions = getSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    
    if (index >= 0) {
        // Atualiza existente e move para o topo
        sessions.splice(index, 1);
        sessions.unshift(session);
    } else {
        // Novo
        sessions.unshift(session);
    }
    
    // Mantém apenas as últimas 50 conversas para não estourar o storage
    if (sessions.length > 50) sessions.pop();
    
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
};

export const clearSessions = () => {
    localStorage.removeItem(SESSIONS_KEY);
};

// --- LEGACY LOGS (Mantido para compatibilidade se necessário) ---
export const getLogs = (): RunLog[] => {
    const saved = localStorage.getItem(LOGS_KEY);
    return saved ? JSON.parse(saved) : [];
};
export const addLog = (log: RunLog) => {
    const logs = getLogs();
    logs.unshift(log); 
    if (logs.length > 100) logs.pop();
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
};

// --- CUSTOM MODELS ---
export const getCustomModels = (): CustomModel[] => {
    const saved = localStorage.getItem(CUSTOM_MODELS_KEY);
    return saved ? JSON.parse(saved) : [];
};

export const saveCustomModel = (model: CustomModel) => {
    const models = getCustomModels();
    models.push(model);
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models));
};

export const setAllCustomModels = (models: CustomModel[]) => {
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models));
};

// --- BACKEND SYNC (DESATIVADO PARA EVITAR CONFLITOS COM SUPABASE) ---
export const syncAgentsToBackend = async () => {
    // Sincronização desativada para evitar loops de duplicatas
    return;
};

export const syncAgentsFromBackend = async (): Promise<AgentConfig[] | null> => {
    // Sincronização desativada para evitar loops de duplicatas
    return null;
};
