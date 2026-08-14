import React, { useState, useRef, useEffect } from 'react';
import { ConversationSession, LogEntry, AnalysisResult } from '../types';
import { analyzeLogWithGemini } from '../services/geminiService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LogDetailProps {
  session: ConversationSession | null;
  onClose: () => void;
}

interface DebugPanelProps {
  log: LogEntry;
}

// Componente para o Separador de Data
const DateDivider: React.FC<{ timestamp: number }> = ({ timestamp }) => (
  <div className="flex items-center justify-center my-6 select-none pointer-events-none">
    <div className="bg-gray-800/80 backdrop-blur border border-gray-700 text-gray-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
      {format(timestamp, "d 'de' MMMM, yyyy", { locale: ptBR })}
    </div>
  </div>
);

// Componente auxiliar para formatar texto (Markdown simples + Quebras de linha)
const FormattedText: React.FC<{ text: string; isUser?: boolean }> = ({ text, isUser }) => {
  if (!text) return null;

  // 1. Normalizar quebras de linha: Transforma <br> explícito em \n
  const normalizedText = text.replace(/<br\s*\/?>/gi, '\n');

  // 2. Separar por blocos de negrito (**texto**)
  // O regex captura o delimitador para podermos iterar sobre ele
  const parts = normalizedText.split(/(\*\*.*?\*\*)/g);

  return (
    <div className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-gray-200'}`}>
      {parts.map((part, index) => {
        // Se for um bloco de negrito
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={index} className="font-bold text-inherit">
              {part.slice(2, -2)}
            </strong>
          );
        }
        // Texto normal (aplica whitespace-pre-wrap para respeitar os \n)
        return (
          <span key={index} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </div>
  );
};

const DebugPanel: React.FC<DebugPanelProps> = ({ log }) => {
  const [activeTab, setActiveTab] = useState<'rag' | 'thoughts' | 'json' | 'analysis'>('rag');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeLogWithGemini(log);
      setAnalysis(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mt-4 bg-[#0d1117] border border-gray-700 rounded-lg overflow-hidden animate-fade-in">
       <div className="flex items-center bg-gray-800/50 border-b border-gray-700 px-2 overflow-x-auto">
         <button onClick={() => setActiveTab('rag')} className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'rag' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            Contexto (RAG) {log.retriever_resources?.length ? `(${log.retriever_resources.length})` : ''}
         </button>
         <button onClick={() => setActiveTab('thoughts')} className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'thoughts' ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            Agent Thoughts {log.agent_thoughts?.length ? `(${log.agent_thoughts.length})` : ''}
         </button>
         <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'analysis' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            Análise Gemini
         </button>
         <button onClick={() => setActiveTab('json')} className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'json' ? 'border-gray-400 text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            Raw JSON
         </button>
       </div>

       <div className="p-4 bg-[#0d1117]">
          
          {/* RAG TAB */}
          {activeTab === 'rag' && (
             <div className="space-y-3">
                {(!log.retriever_resources || log.retriever_resources.length === 0) ? (
                   <div className="text-gray-500 text-xs italic">Nenhum contexto recuperado.</div>
                ) : (
                   log.retriever_resources.map((res, idx) => (
                      <div key={idx} className="bg-gray-900 border border-gray-800 rounded p-3">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-blue-400 font-bold text-xs">{res.document_name}</span>
                            <span className="text-gray-500 text-[10px]">Score: {res.score.toFixed(2)}</span>
                         </div>
                         <p className="text-xs text-gray-300 font-serif border-l-2 border-blue-500/30 pl-2 whitespace-pre-wrap">{res.content}</p>
                      </div>
                   ))
                )}
             </div>
          )}

          {/* THOUGHTS TAB */}
          {activeTab === 'thoughts' && (
             <div className="space-y-4">
                {(!log.agent_thoughts || log.agent_thoughts.length === 0) ? (
                   <div className="text-gray-500 text-xs italic">Sem logs de pensamento.</div>
                ) : (
                   log.agent_thoughts.map((t, idx) => (
                      <div key={idx} className="relative pl-4 border-l border-gray-700">
                         <div className="absolute -left-1.5 top-0 w-3 h-3 bg-gray-800 border border-gray-600 rounded-full"></div>
                         <div className="mb-1">
                            <span className="text-[10px] text-orange-400 uppercase font-bold">Step {idx + 1}</span>
                            {t.tool && <span className="ml-2 text-[10px] bg-gray-800 px-1 rounded text-gray-300">{t.tool}</span>}
                         </div>
                         {t.thought && <div className="text-xs text-gray-300 italic mb-1 whitespace-pre-wrap">"{t.thought}"</div>}
                         {t.tool_input && <div className="text-[10px] font-mono text-gray-500 bg-black/20 p-1 rounded">In: {t.tool_input}</div>}
                         {t.observation && <div className="text-[10px] font-mono text-green-400/70 bg-black/20 p-1 rounded mt-1 whitespace-pre-wrap">Out: {t.observation}</div>}
                      </div>
                   ))
                )}
             </div>
          )}

          {/* ANALYSIS TAB */}
          {activeTab === 'analysis' && (
             <div>
                {!analysis ? (
                   <div className="text-center py-4">
                      <button 
                         onClick={handleAnalyze}
                         disabled={isAnalyzing}
                         className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded transition-colors flex items-center gap-2 mx-auto"
                      >
                         {isAnalyzing ? 'Analisando...' : 'Gerar Análise de Qualidade (IA)'}
                      </button>
                   </div>
                ) : (
                   <div className="space-y-3 animate-fade-in">
                      <div className="bg-purple-900/10 border border-purple-500/20 p-3 rounded">
                         <h4 className="text-purple-400 text-xs font-bold mb-1">Resumo</h4>
                         <p className="text-gray-300 text-xs">{analysis.summary}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <div className="bg-gray-900 p-2 rounded border border-gray-800">
                            <span className="text-gray-500 text-[10px] uppercase">Sentimento</span>
                            <div className="text-sm text-gray-200">{analysis.sentiment}</div>
                         </div>
                      </div>
                      <div className="bg-yellow-900/10 border border-yellow-600/20 p-3 rounded">
                         <h4 className="text-yellow-500 text-xs font-bold mb-1">Sugestões</h4>
                         <p className="text-gray-300 text-xs">{analysis.suggestions}</p>
                      </div>
                   </div>
                )}
             </div>
          )}

          {/* JSON TAB */}
          {activeTab === 'json' && (
             <pre className="text-[10px] text-gray-400 font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(log, null, 2)}
             </pre>
          )}
       </div>
    </div>
  );
};

export const LogDetail: React.FC<LogDetailProps> = ({ session, onClose }) => {
  // State to track which message has its debug panel open
  const [openDebugId, setOpenDebugId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to TOP when opening a new session (Start of conversation)
    if (scrollRef.current) {
       scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [session?.id]);

  if (!session) return null;

  const toggleDebug = (msgId: string) => {
    setOpenDebugId(openDebugId === msgId ? null : msgId);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[800px] bg-[#0d1117] border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col">
      
      {/* Header */}
      <div className="h-16 border-b border-gray-800 px-6 flex items-center justify-between bg-gray-900/90 backdrop-blur">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-blue-500">Chat Inspector</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{format(session.created_at, "d MMM, HH:mm", { locale: ptBR })}</span>
            <span>•</span>
            <span>{session.messages.length} Mensagens</span>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#0d1117] p-6 custom-scrollbar space-y-8">
         {session.messages.map((msg, idx) => {
            // Lógica para verificar mudança de data
            const prevMsg = session.messages[idx - 1];
            const isFirst = idx === 0;
            // Comparar strings de data (YYYY-MM-DD)
            const currentDay = format(msg.created_at, 'yyyy-MM-dd');
            const prevDay = prevMsg ? format(prevMsg.created_at, 'yyyy-MM-dd') : '';
            const isNewDay = currentDay !== prevDay;

            return (
              <React.Fragment key={msg.id}>
                
                {/* Mostra o separador se for a primeira mensagem ou se o dia mudou */}
                {(isFirst || isNewDay) && (
                   <DateDivider timestamp={msg.created_at} />
                )}

                <div className="group">
                   {/* USER BUBBLE */}
                   <div className="flex justify-end mb-2">
                      <div className="max-w-[85%]">
                         <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm">
                            <FormattedText text={msg.inputs.query} isUser={true} />
                         </div>
                         <div className="text-right text-[10px] text-gray-600 mt-1 pr-1">
                            {format(msg.created_at, 'HH:mm')}
                         </div>
                      </div>
                   </div>

                   {/* AI BUBBLE */}
                   <div className="flex justify-start">
                      <div className="max-w-[90%] w-full">
                         <div className="bg-gray-800 text-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm border border-gray-700 shadow-sm">
                            <FormattedText text={msg.outputs} isUser={false} />
                         </div>
                         
                         {/* AI Footer Controls */}
                         <div className="flex items-center gap-3 mt-2 ml-1">
                            <button 
                               onClick={() => toggleDebug(msg.id)}
                               className={`text-[10px] font-medium px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                                  openDebugId === msg.id 
                                   ? 'bg-gray-700 text-white border-gray-500' 
                                   : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                               }`}
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                               {openDebugId === msg.id ? 'Ocultar Detalhes' : 'Inspecionar Resposta'}
                            </button>
                            
                            {msg.retriever_resources && msg.retriever_resources.length > 0 && (
                               <span className="text-[10px] text-blue-500 bg-blue-900/10 px-1.5 py-0.5 rounded border border-blue-900/30">
                                  {msg.retriever_resources.length} docs
                               </span>
                            )}
                            
                            <span className="text-[10px] text-gray-600 font-mono">{msg.latency}ms</span>
                         </div>

                         {/* INLINE DEBUG PANEL */}
                         {openDebugId === msg.id && (
                            <DebugPanel log={msg} />
                         )}
                      </div>
                   </div>
                </div>
              </React.Fragment>
            );
         })}
      </div>
    </div>
  );
};