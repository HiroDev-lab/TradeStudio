
import React, { useState } from 'react';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: {
    title: string;
    message: string;
    url: string;
    method: string;
    apiKey: string;
    statusCode?: number;
  } | null;
}

export const DebugModal: React.FC<DebugModalProps> = ({ isOpen, onClose, error }) => {
  const [tab, setTab] = useState<'cmd' | 'ps'>('cmd');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !error) return null;

  // Generate Windows CMD compatible CURL (Double quotes everywhere)
  const generateCmdCurl = () => {
    return `curl -X ${error.method} "${error.url}" -H "Authorization: Bearer ${error.apiKey}" -H "Content-Type: application/json" -v`;
  };

  // Generate PowerShell compatible CURL (Explicit curl.exe to avoid alias issues)
  const generatePsCurl = () => {
    return `curl.exe -X ${error.method} "${error.url}" -H "Authorization: Bearer ${error.apiKey}" -H "Content-Type: application/json" -v`;
  };

  const currentCommand = tab === 'cmd' ? generateCmdCurl() : generatePsCurl();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentCommand);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-[#161b22] border border-red-900/50 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-red-900/20 px-6 py-4 border-b border-red-900/30 flex items-center justify-between">
          <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {error.title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {/* Error Message */}
          <div className="bg-red-950/30 border border-red-900/30 rounded-lg p-4 mb-6">
            <h3 className="text-red-300 font-bold text-sm uppercase tracking-wider mb-2">Detalhes do Erro (Status {error.statusCode})</h3>
            <pre className="text-xs text-red-200 whitespace-pre-wrap font-mono">{error.message}</pre>
          </div>

          {/* Diagnosis */}
          <div className="mb-6 text-sm text-gray-300 space-y-2">
             <p><strong className="text-white">Diagnóstico Provável:</strong></p>
             <ul className="list-disc pl-5 space-y-1 text-gray-400">
                {error.statusCode === 404 && (
                    <>
                        <li>O <strong>Conversation ID</strong> não existe.</li>
                        <li>Ou o <strong>User ID</strong> configurado não é o dono desta conversa.</li>
                        <li>Ou você está usando a <strong>API Key</strong> do agente errado (Estela vs Iara).</li>
                    </>
                )}
                {error.statusCode === 400 && (
                    <li>O formato do ID está inválido (deve ser um UUID).</li>
                )}
                {error.statusCode === 401 && (
                    <li>A API Key está incorreta ou expirada.</li>
                )}
                 {error.statusCode === 200 && (
                    <li>A requisição foi bem sucedida mas retornou vazia. Verifique se o User ID está correto.</li>
                )}
             </ul>
          </div>

          {/* Command Generator */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
             <div className="flex border-b border-gray-700 bg-gray-800">
                <button 
                   onClick={() => setTab('cmd')}
                   className={`px-4 py-2 text-xs font-bold transition-colors ${tab === 'cmd' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                   Windows CMD
                </button>
                <button 
                   onClick={() => setTab('ps')}
                   className={`px-4 py-2 text-xs font-bold transition-colors ${tab === 'ps' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                   PowerShell
                </button>
             </div>
             <div className="p-4 relative group">
                <pre className="text-[10px] text-green-400 font-mono break-all whitespace-pre-wrap">
                   {currentCommand}
                </pre>
                <button 
                   onClick={copyToClipboard}
                   className={`absolute top-2 right-2 text-xs px-3 py-1.5 rounded shadow transition-all font-bold flex items-center gap-1 ${isCopied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                >
                   {isCopied ? (
                       <>
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                         Copiado!
                       </>
                   ) : (
                       'Copiar'
                   )}
                </button>
             </div>
             <div className="px-4 py-2 bg-gray-800 text-[10px] text-gray-500 border-t border-gray-700">
                Cole este comando no seu terminal para testar a conexão direta com a API.
             </div>
          </div>
        </div>

        <div className="bg-gray-900 px-6 py-4 border-t border-gray-800 flex justify-end">
           <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Fechar</button>
        </div>

      </div>
    </div>
  );
};
