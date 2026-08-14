import React, { useState, useEffect } from 'react';
import { DifyConfig } from '../types.js';
import { KNOWN_AGENTS, DEFAULT_DIFY_URL, DEFAULT_DIFY_USER } from '../constants.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: DifyConfig) => void;
  initialConfig: DifyConfig | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, initialConfig }) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_DIFY_URL);
  const [userId, setUserId] = useState(DEFAULT_DIFY_USER);
  const [selectedAgentName, setSelectedAgentName] = useState<string>('Custom');

  useEffect(() => {
    if (initialConfig) {
      setApiKey(initialConfig.apiKey);
      setBaseUrl(initialConfig.baseUrl);
      setUserId(initialConfig.userId);
      
      // Detect current agent
      if (initialConfig.apiKey === KNOWN_AGENTS.ESTELA.apiKey) setSelectedAgentName(KNOWN_AGENTS.ESTELA.name);
      else if (initialConfig.apiKey === KNOWN_AGENTS.IARA.apiKey) setSelectedAgentName(KNOWN_AGENTS.IARA.name);
      else setSelectedAgentName('Custom');
    } else {
      // Default to Estela if no config
      selectAgent(KNOWN_AGENTS.ESTELA);
    }
  }, [initialConfig, isOpen]);

  const selectAgent = (agent: typeof KNOWN_AGENTS.ESTELA) => {
    setApiKey(agent.apiKey);
    setSelectedAgentName(agent.name);
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ apiKey, baseUrl, userId, agentName: selectedAgentName });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#111827] border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
             <div className="w-6 h-6 rounded bg-tradestudio-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
             </div>
            Conexão tradestudio API
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Agent Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">1. Agente (Endpoint)</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => selectAgent(KNOWN_AGENTS.ESTELA)}
                className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  selectedAgentName === KNOWN_AGENTS.ESTELA.name 
                  ? 'bg-tradestudio-900/40 border-tradestudio-500 ring-1 ring-tradestudio-500' 
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                }`}
              >
                <span className="text-2xl">{KNOWN_AGENTS.ESTELA.avatar}</span>
                <div className="text-left">
                  <div className={`font-bold ${selectedAgentName === KNOWN_AGENTS.ESTELA.name ? 'text-tradestudio-400' : 'text-gray-200'}`}>
                    {KNOWN_AGENTS.ESTELA.name}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate w-32">Production Env</div>
                </div>
                {selectedAgentName === KNOWN_AGENTS.ESTELA.name && (
                   <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-tradestudio-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                )}
              </button>

              <button 
                onClick={() => selectAgent(KNOWN_AGENTS.IARA)}
                className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  selectedAgentName === KNOWN_AGENTS.IARA.name 
                  ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-500' 
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                }`}
              >
                <span className="text-2xl">{KNOWN_AGENTS.IARA.avatar}</span>
                <div className="text-left">
                  <div className={`font-bold ${selectedAgentName === KNOWN_AGENTS.IARA.name ? 'text-blue-400' : 'text-gray-200'}`}>
                    {KNOWN_AGENTS.IARA.name}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate w-32">Staging Env</div>
                </div>
                {selectedAgentName === KNOWN_AGENTS.IARA.name && (
                   <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                )}
              </button>
            </div>
          </div>
          
          {/* User ID Input - TEXTAREA */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">2. Lista de Alunos (IDs)</label>
            <div className="relative">
              <textarea 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full h-32 bg-black/20 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-tradestudio-500 focus:ring-1 focus:ring-tradestudio-500 transition-all placeholder-gray-600 font-mono text-xs leading-relaxed resize-none custom-scrollbar"
                placeholder={`Cole a lista de IDs aqui...\n\n5524981544543\n34722542956\n...`}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              Duplicatas são removidas automaticamente.
            </p>
          </div>

          {/* Advanced (Collapsible) */}
          <div className="pt-4 border-t border-gray-800">
             <details className="group">
                <summary className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none">
                   <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-open:rotate-90 transition-transform"><polyline points="9 18 15 12 9 6"></polyline></svg>
                   Endpoint Personalizado (Dev Mode)
                </summary>
                <div className="mt-3 space-y-3 pl-2 border-l border-gray-800 ml-1.5">
                    <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Base URL</label>
                        <input 
                        type="text" 
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-tradestudio-500"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 mb-1">API Key (Full)</label>
                        <input 
                        type="text" 
                        value={apiKey}
                        onChange={(e) => {
                            setApiKey(e.target.value);
                            setSelectedAgentName('Custom');
                        }}
                        className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-tradestudio-500 font-mono"
                        />
                    </div>
                </div>
             </details>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700 flex justify-end gap-3 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-tradestudio-600 text-white hover:bg-tradestudio-500 font-medium shadow-lg shadow-tradestudio-900/50 transition-all text-sm"
          >
            Confirmar Conexão
          </button>
        </div>
      </div>
    </div>
  );
};
