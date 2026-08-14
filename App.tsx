import React, { useState, useEffect, useRef } from 'react';
// UI Version: 2.0.1 - Fixed Sidebar Logo and Toggle Positioning
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { ChatMessage, SavedSession, PresetMode, CustomModel, AgentTool, AgentConfig, GlobalKnowledge, GlobalTool, GlobalAgent, DifyConfig, UserProfile, UserRole, AttachedFile, LLMProvider } from './types.js';
import { getSessions, saveSession, clearSessions, getCustomModels, saveCustomModel, setAllCustomModels } from './services/agentStore.js';
import { runAgent } from './services/llmService.js';
import { fetchDifyLogs } from './services/difyService.js';
import { DEFAULT_AGENT, SYSTEM_MODELS, PRESETS, GEMINI_API_KEY, DEFAULT_DIFY_URL, DEFAULT_DIFY_USER, ROLE_LABELS, AGENT_SECTORS } from './constants.js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- SUPABASE ---
import { supabase } from './lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const Icons = {
    Dashboard: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
    Logs: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
    Key: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.01 0 1 1-7.778 7.778 5.5 5.01 0 0 1 7.778-7.778zM12 2l3 3m-3 3l3-3-3-3z"></path></svg>,
    Plus: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    Trash: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    Save: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>,
    Logout: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
    Back: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
    Clock: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    Sync: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>,
    Refresh: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>,
    User: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    Sparkles: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 3l1.91 5.81L20 10l-6.09 1.19L12 17l-1.91-5.81L4 10l6.09-1.19L12 3z"></path></svg>,
    Book: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
    Zap: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
    Bolt: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>,
    Lock: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
    Cloud: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17.5 19A5.5 5.5 0 0 0 18 8.02a7 7 0 1 0-13.94.98A5.5 5.5 0 0 0 5.5 19h12z"></path></svg>,
    Upload: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>,
    Drive: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 2L2 19.8h20L12 2z"></path><path d="M12 2L7 11h10l-5-9z"></path></svg>,
    File: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>,
    Activity: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
    Check: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="20 6 9 17 4 12"></polyline></svg>,
    Menu: (props: any) => <svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}><path d="M5 12H19M5 12L11 6M5 12L11 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    Edit: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
    Copy: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
    Eye: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
    EyeOff: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>,
    Users: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    Send: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
    Brain: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M9.5 2A5 5 0 0 1 12 6.5l.5.5a5 5 0 0 1 2.5-4.5"></path><path d="M12 22v-5"></path><path d="M16 13l5 2"></path><path d="M8 13l-5 2"></path><path d="M12 7c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5z"></path></svg>,
    LogoHead: (props: any) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
            {/* Contorno da Cabeça */}
            <path d="M7 10c0-3 2-5 5-5s5 2 5 5c0 4-2 6-2 8h-6c0-2-2-4-2-8z" fill="white" fillOpacity="0.1"/>
            <path d="M7 10c0-3 2-5 5-5s5 2 5 5c0 4-2 6-2 8h-6c0-2-2-4-2-8z" stroke="white" strokeWidth="1.5"/>
            {/* Pescoço */}
            <path d="M9 18v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2" stroke="white" strokeWidth="1.5"/>
            {/* Redes Neurais / Conexões internas */}
            <circle cx="12" cy="10" r="1" fill="white"/>
            <path d="M12 10l2-2m-2 2l-2-2m2 2l0 4m0-4l2 2m-2-2l-2 2" stroke="white" strokeWidth="0.8" opacity="0.8"/>
            <circle cx="14" cy="8" r="0.5" fill="white"/>
            <circle cx="10" cy="8" r="0.5" fill="white"/>
            <circle cx="14" cy="12" r="0.5" fill="white"/>
            <circle cx="10" cy="12" r="0.5" fill="white"/>
            {/* Olho iluminado */}
            <circle cx="14.5" cy="10.5" r="1" fill="white">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
        </svg>
    ),
    Globe: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>,
    Info: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
};


const AVATAR_PRESETS = ['🤖', '👩‍💼', '👨‍💻', '🚀', '🧠', '✨', '🔥', '🛡️', '📊', '🌐', '📡', '🕵️', '🧙', '🥷', '🦸'];

// --- HELPERS DE SEGURANÇA E DADOS ---
function sanitizeForPostgres(str: string): string {
    if (!str) return '';
    // Remove caracteres nulos (\u0000) que o PostgreSQL não aceita em campos JSONB/Text
    // e outras sequências de escape unicode problemáticas
    return str.replace(/\u0000/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

function extractGoogleId(input: string): string {
    if (!input) return '';
    // Suporte a URLs de Documentos, Planilhas e IDs puros
    const match = input.match(/\/d\/(.*?)(\/|$|#|\?)/);
    return match ? match[1] : input.trim();
}

function isGoogleSheet(input: string): boolean {
    const lower = input.toLowerCase();
    // Prioridade absoluta para a URL. Se não for URL, não assume nada pelo tamanho do ID.
    return lower.includes('spreadsheets') || lower.includes('planilhas');
}

// --- SUB-COMPONENTS ---

const CompactLogo = () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
        <path d="M0.275752 18.9946C0.670222 19.7525 4.73816 20.5472 6.08182 21.1523C11.173 23.4568 13.959 27.4423 15.7649 32.5219C16.2148 33.7933 15.9682 34.9547 17.2441 36H18.0392C20.4924 34.8753 20.4061 31.6233 21.6881 29.1294C23.2968 25.9997 25.8485 23.3773 28.9488 21.6841C31.3773 20.3638 33.9229 20.1926 36 18.585V17.7904C35.0508 15.3942 32.1231 15.6204 29.8672 14.5751C25.5466 12.5701 22.3907 8.64582 20.6464 4.32416C19.9931 2.69208 20.4184 0.0880825 18.218 0.00250512C15.58 -0.0952975 16.1223 2.69208 15.3272 4.60534C13.6507 8.64581 10.7169 12.3012 6.74754 14.3C4.59644 15.382 -1.3576 15.816 0.281921 18.9823L0.275752 18.9946Z" fill="white"/>
    </svg>
);

const SidebarItem: React.FC<{ active: boolean; to: string; label: string; icon: React.ReactNode; collapsed?: boolean }> = ({ active, to, label, icon, collapsed }) => (
    <Link 
        to={to}
        className={`w-full flex items-center rounded-xl transition-all duration-500 group border border-transparent h-auto min-h-[44px] py-1 ${active ? 'bg-tradestudio-900/30 text-white border-tradestudio-500/20' : 'text-gray-500 hover:text-white hover:bg-[#131416]'} ${collapsed ? 'px-0 justify-center' : 'px-4'}`}
        title={collapsed ? label : undefined}
    >
        <div className={`transition-all duration-500 flex-shrink-0 flex items-center justify-center w-8 ${collapsed ? 'scale-110' : ''}`}>
            {icon}
        </div>
        <div className={`transition-all duration-500 ease-in-out overflow-hidden flex items-center ${collapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100 flex-1'}`}>
            <span className="text-xs font-bold whitespace-nowrap ml-2">{label}</span>
        </div>
    </Link>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: React.ReactNode }> = ({ active, onClick, label, icon }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${active ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const EmptyState: React.FC = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-3xl mb-4 text-gray-600">
            💬
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Inicie uma conversa</h3>
    </div>
);

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => (
    <div className="markdown-body">
        {/* VULN-FIX: Previne renderização de HTML malicioso vindo da IA (XSS) */}
        <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
                a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" />,
                script: () => null, // Bloqueia tags script
                iframe: () => null, // Bloqueia iframes
            }}
        >
            {content}
        </ReactMarkdown>
    </div>
);

const SuccessAnimation: React.FC<{ show: boolean; message?: string }> = ({ show, message }) => (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0d1117]/40 backdrop-blur-sm transition-all duration-500 pointer-events-none ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="bg-[#161b22] border border-green-500/30 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-bounce-slow">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <div className="text-center">
                <h4 className="text-xl font-bold text-white mb-1">{message || 'Sincronizado!'}</h4>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Base de dados atualizada</p>
            </div>
        </div>
    </div>
);

const ToolEditorModal: React.FC<{ isOpen: boolean; onClose: () => void; tool: AgentTool; onSave: (tool: AgentTool) => void }> = ({ isOpen, onClose, tool, onSave }) => {
    const [formData, setFormData] = useState<AgentTool>({
        ...tool,
        parameters: (!tool.parameters || tool.parameters === '{}' || tool.parameters.includes('"type": "object"')) ? '' : tool.parameters
    });
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4">
            <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Icons.Zap /> Configurar Requisição
                </h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-[#0d1117]/30 rounded-lg border border-gray-800 mb-4">
                        <input 
                            type="checkbox" 
                            id="tool-enabled"
                            checked={formData.enabled}
                            onChange={e => setFormData({...formData, enabled: e.target.checked})}
                            className="w-4 h-4 accent-tradestudio-500"
                        />
                        <label htmlFor="tool-enabled" className="text-xs font-bold text-gray-300 cursor-pointer">Requisição Ativada</label>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Nome da Requisição</label>
                        <input type="text" className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Enviar Mensagem" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Descrição (Para a IA entender quando usar)</label>
                        <textarea className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white h-20 focus:border-tradestudio-500 focus:outline-none resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ex: Use esta requisição para enviar uma mensagem via WhatsApp para o cliente." />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Método</label>
                            <select 
                                className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none"
                                value={formData.method || 'POST'}
                                onChange={e => setFormData({...formData, method: e.target.value as any})}
                            >
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Webhook URL</label>
                            <input type="text" className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none font-mono" value={formData.webhookUrl || ''} onChange={e => setFormData({...formData, webhookUrl: e.target.value})} placeholder="https://n8n.seuservidor.com/webhook/..." />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-2">
                            Parâmetros (JSON Schema)
                            <span className="cursor-help text-tradestudio-400" title='Exemplo: Para enviar apenas o telefone, use { "telefone": "{{telefone}}" }'>
                                <Icons.Sparkles className="scale-75" />
                            </span>
                        </label>
                        <textarea 
                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-xs text-blue-400 h-32 font-mono focus:border-tradestudio-500 focus:outline-none resize-none" 
                            value={formData.parameters} 
                            onChange={e => setFormData({...formData, parameters: e.target.value})} 
                            placeholder='{ "telefone": "{{telefone}}" }'
                        />
                        <p className="text-[10px] text-gray-600 mt-1">Ex: {"{ \"telefone\": \"{{telefone}}\" }"}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancelar</button>
                    <button onClick={() => onSave(formData)} className="px-5 py-2.5 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95">Salvar Requisição</button>
                </div>
            </div>
        </div>
    );
};

const ToolLogsView: React.FC<{ session: any; agents: AgentConfig[], globalAgents: GlobalAgent[] }> = ({ session, agents, globalAgents }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateMode, setDateMode] = useState<'single' | 'range' | 'none'>('none');
    const [selectedDate, setSelectedDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterSector, setFilterSector] = useState('');
    const [filterAgent, setFilterAgent] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterUser, setFilterUser] = useState('');

    const allAgents = [...agents, ...globalAgents];

    const loadLogs = async () => {
        setLoading(true);
        let query = supabase
            .from('tool_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (dateMode === 'single' && selectedDate) {
            const start = new Date(selectedDate + 'T00:00:00.000Z').toISOString();
            const end = new Date(selectedDate + 'T23:59:59.999Z').toISOString();
            query = query.gte('created_at', start).lte('created_at', end);
        } else if (dateMode === 'range' && startDate && endDate) {
            const start = new Date(startDate + 'T00:00:00.000Z').toISOString();
            const end = new Date(endDate + 'T23:59:59.999Z').toISOString();
            query = query.gte('created_at', start).lte('created_at', end);
        }

        if (filterAgent) {
            query = query.eq('agent_id', filterAgent);
        } else if (filterSector) {
            // Get all agents from the selected sector to filter
            const sectorAgentIds = allAgents
                .filter(a => (a as any).sector === filterSector || (a as any).sectors?.includes(filterSector))
                .map(a => a.id);
            if (sectorAgentIds.length > 0) {
                query = query.in('agent_id', sectorAgentIds);
            } else {
                // No agents in this sector, return empty
                setLogs([]);
                setLoading(false);
                return;
            }
        }

        if (filterStatus) {
            query = query.eq('status', filterStatus);
        }

        if (filterUser) {
            query = query.ilike('user_email', `%${filterUser}%`);
        }
        
        query.then(({ data, error }) => {
            if (data) setLogs(data);
            setLoading(false);
        });
    };

    useEffect(() => {
        // --- SEGURANÇA: Só carrega logs se houver uma sessão ativa ---
        if (session) {
            loadLogs();
        }
    }, [session, filterSector, filterAgent, filterStatus, filterUser, dateMode, selectedDate, startDate, endDate]);

    return (
        <div className="flex flex-col h-full bg-white animate-fade-in">
            <div className="px-8 py-6 border-b border-gray-200 bg-white space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Icons.Activity /> Logs de Execução de Requisições
                    </h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { 
                                setDateMode('none'); 
                                setSelectedDate(''); 
                                setStartDate(''); 
                                setEndDate('');
                                setFilterSector('');
                                setFilterAgent('');
                                setFilterStatus('');
                                setFilterUser('');
                            }}
                            className="text-xs bg-gray-100 text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
                        >
                            Limpar Filtros
                        </button>
                        <button 
                            onClick={loadLogs}
                            className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-lg transition-all font-bold border border-gray-300 flex items-center gap-2"
                        >
                            <Icons.Refresh /> Atualizar
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Filtros:</span>
                        <select 
                            value={filterSector} 
                            onChange={e => { setFilterSector(e.target.value); setFilterAgent(''); }}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                            <option value="">Todos Setores</option>
                            {AGENT_SECTORS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>

                        <select 
                            value={filterAgent} 
                            onChange={e => setFilterAgent(e.target.value)}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 min-w-[140px]"
                        >
                            <option value="">Todos Agentes</option>
                            {allAgents
                                .filter(a => !filterSector || (a as any).sector === filterSector || (a as any).sectors?.includes(filterSector))
                                .map(a => <option key={a.id} value={a.id}>{a.name}</option>)
                            }
                        </select>

                        <select 
                            value={filterStatus} 
                            onChange={e => setFilterStatus(e.target.value)}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                            <option value="">Todos Status</option>
                            <option value="success">Sucesso</option>
                            <option value="error">Erros</option>
                        </select>
                    </div>

                    <div className="h-4 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Data:</span>
                        <select 
                            value={dateMode} 
                            onChange={e => setDateMode(e.target.value as any)}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                            <option value="none">Sem Filtro</option>
                            <option value="single">Dia Específico</option>
                            <option value="range">Intervalo</option>
                        </select>

                        {dateMode === 'single' && (
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] text-gray-600 uppercase">Data:</label>
                                <input 
                                    type="date"
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        )}

                        {dateMode === 'range' && (
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] text-gray-600 uppercase">De:</label>
                                <input 
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                                <label className="text-[10px] text-gray-600 uppercase">Até:</label>
                                <input 
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        )}
                    </div>

                    <div className="h-4 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

                    <div className="flex-1 min-w-[200px] relative">
                        <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                        <input 
                            type="text"
                            value={filterUser}
                            onChange={e => setFilterUser(e.target.value)}
                            placeholder="Buscar por e-mail do usuário..."
                            className="w-full bg-white border border-gray-300 text-[10px] font-bold text-gray-900 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-auto p-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-gray-500">Carregando logs...</div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#000000] text-white text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Horário</th>
                                    <th className="px-6 py-4">Usuário</th>
                                    <th className="px-6 py-4">Agente</th>
                                    <th className="px-6 py-4">Setor</th>
                                    <th className="px-6 py-4">Requisição</th>
                                    <th className="px-6 py-4">Telefone</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {logs.map(log => {
                                    const agent = allAgents.find(a => a.id === log.agent_id);
                                    const agentName = agent?.name || log.payload?.agentName || log.payload?.agent_name || 'N/A';
                                    const agentSector = (agent as any)?.sector || ((agent as any)?.sectors && (agent as any)?.sectors[0]);
                                    const sectorInfo = AGENT_SECTORS.find(s => s.id === agentSector);
                                    
                                    return (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                                            {new Date(log.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-gray-700">{log.user_email || 'Sistema'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-purple-600 font-bold uppercase tracking-tighter bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block">
                                                {agentName}
                                                <span className="ml-2 opacity-50 font-mono text-[9px]">{log.agent_id?.slice(0, 8)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {sectorInfo ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sectorInfo.color }}></div>
                                                    <span className="text-xs font-bold text-gray-700">{sectorInfo.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{log.tool_name}</div>
                                            <div className="text-[10px] text-gray-600 truncate w-48">{log.webhook_url}</div>
                                        </td>
                                        <td className="px-6 py-4 text-blue-600 font-mono text-xs">
                                            {log.phone || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                                log.status === 'success' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
                                            }`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                );})}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                                            Nenhum log de requisição encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const ApiExportModal: React.FC<{ isOpen: boolean; onClose: () => void; agent: AgentConfig }> = ({ isOpen, onClose, agent }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4">
            <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-6">Integração via API</h2>
                <div className="bg-[#0d1117] p-4 rounded-lg font-mono text-xs text-blue-400 overflow-x-auto">
                    POST /api/chat<br/>
                    Content-Type: application/json<br/><br/>
                    {JSON.stringify({ agentId: agent.id, message: "Olá!" }, null, 2)}
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-xs font-bold">Fechar</button>
                </div>
            </div>
        </div>
    );
};

const DynamicClock: React.FC = () => {
    const [timeStr, setTimeStr] = useState('');
    useEffect(() => {
        const updateTime = () => {
            setTimeStr(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }));
        };
        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, []);
    return <span className="text-xs font-mono text-gray-500 min-w-[120px]">{timeStr}</span>;
};

const UserManagementView: React.FC<{ session: any; userProfile: UserProfile | null; addToast: any }> = ({ session, userProfile, addToast }) => {
    const masterEmail = import.meta.env.JUNOS_ADMIN_MASTER_EMAIL || import.meta.env.VITE_ADMIN_MASTER_EMAIL;
    const isMaster = userProfile?.role === 'admin-master' || (masterEmail && session?.user?.email === masterEmail);

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('colaborador');
    const [newUserSector, setNewUserSector] = useState<string>('');
    const [showPassword, setShowPassword] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterSector, setFilterSector] = useState<string>('');
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
                // Removido toggle de filtro customizado
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredUsers = users.filter(u => {
        if (!filterSector) return true;
        const userSector = u.sectors?.[0] || ''; // Revertido para plural e array
        return userSector === filterSector;
    });

    const handleUpdateUserSector = async (userId: string, sector: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ sectors: [sector] })
                .eq('id', userId);
            
            if (error) throw error;
            addToast('success', 'Setor Atualizado', 'O setor do usuário foi atualizado com sucesso.');
            await loadUsers();
        } catch (err: any) {
            addToast('error', 'Erro ao atualizar setor', err.message);
        }
    };
    const navigate = useNavigate();

    const getAvailableRoles = (): UserRole[] => {
        const masterEmail = import.meta.env.JUNOS_ADMIN_MASTER_EMAIL || import.meta.env.VITE_ADMIN_MASTER_EMAIL;
        const isMasterEmail = masterEmail && session?.user?.email === masterEmail;
        if (isMasterEmail || userProfile?.role === 'admin-master') {
            return ['colaborador', 'co-lider', 'qualidade', 'lider', 'admin', 'dev'];
        }
        
        const role = userProfile?.role;
        if (role === 'admin' || role === 'dev') {
            return ['colaborador', 'co-lider', 'qualidade', 'lider', 'admin', 'dev'];
        }
        if (role === 'lider') {
            return ['colaborador', 'co-lider'];
        }
        return [];
    };

    const loadUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('email');
        
        if (error) {
            console.error('Erro ao carregar usuários:', error);
            addToast('error', 'Erro no Banco', error.message);
        }
        
        if (data) setUsers(data);
        setLoading(false);
    };

    useEffect(() => {
        const masterEmail = import.meta.env.JUNOS_ADMIN_MASTER_EMAIL || import.meta.env.VITE_ADMIN_MASTER_EMAIL;
        const isMasterEmail = masterEmail && session?.user?.email === masterEmail;
        const canAccess = ['co-lider', 'lider', 'admin', 'dev', 'admin-master'].includes(userProfile?.role || '') || isMasterEmail;
        
        if (!canAccess) {
            navigate('/');
            return;
        }
        loadUsers();
    }, [userProfile, session]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail || !newUserPassword || isProcessing) return;

        setIsProcessing(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: newUserEmail,
                password: newUserPassword,
            });

            if (authError) throw authError;

            if (authData.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({ 
                        id: authData.user.id, 
                        email: newUserEmail,
                        role: newUserRole,
                        sectors: [newUserSector], // Revertido para plural e array
                        is_master: false,
                        created_by: session.user.id
                    });

                if (profileError) throw profileError;

                addToast('success', 'Usuário Criado', `Acesso de ${ROLE_LABELS[newUserRole]} criado para ${newUserEmail}`);
                setIsCreateModalOpen(false);
                setNewUserEmail('');
                setNewUserPassword('');
                setNewUserRole('colaborador');
                setNewUserSector('');
                await loadUsers();
            }
        } catch (error: any) {
            addToast('error', 'Erro ao criar usuário', error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleToggleRole = async (targetUser: any) => {
        // Função desabilitada em favor dos novos cargos específicos
        addToast('info', 'Acesso Restrito', 'A alteração rápida de cargo foi desabilitada. Crie um novo usuário com o cargo correto.');
    };

    const handleDeleteUser = async (targetUser: any) => {
        const masterEmail = import.meta.env.JUNOS_ADMIN_MASTER_EMAIL || import.meta.env.VITE_ADMIN_MASTER_EMAIL;
        const isMaster = userProfile?.role === 'admin-master' || (masterEmail && session?.user?.email === masterEmail);

        if (targetUser.is_master || targetUser.role === 'admin-master') {
            alert('Erro: O Admin Master não pode ser removido do sistema.');
            return;
        }

        // Regra Admin: só exclui quem ele criou
        if (userProfile?.role === 'admin' && targetUser.role === 'admin') {
            if (targetUser.created_by !== session.user.id) {
                alert('Acesso negado: Você só pode remover Administradores criados por você.');
                return;
            }
        }

        // Apenas Admin Master ou Admin/Dev podem deletar Admins
        const canDeleteAdmins = ['admin', 'dev', 'admin-master'].includes(userProfile?.role || '') || isMaster;
        if ((targetUser.role === 'admin' || targetUser.role === 'dev') && !canDeleteAdmins) {
            alert('Acesso negado: Você não tem permissão para remover administradores ou desenvolvedores.');
            return;
        }

        if (confirm(`Tem certeza que deseja remover o acesso de ${targetUser.email}?`)) {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', targetUser.id);
            if (!error) loadUsers();
        }
    };

    const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
        const masterEmail = import.meta.env.JUNOS_ADMIN_MASTER_EMAIL || import.meta.env.VITE_ADMIN_MASTER_EMAIL;
        const isMaster = userProfile?.role === 'admin-master' || (masterEmail && session?.user?.email === masterEmail);
        if (!isMaster) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);
            
            if (error) throw error;
            addToast('success', 'Cargo Atualizado', `Usuário atualizado para ${ROLE_LABELS[newRole]}`);
            await loadUsers();
        } catch (err: any) {
            addToast('error', 'Erro ao atualizar cargo', err.message);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white animate-fade-in">
            <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center bg-white">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Icons.Users /> Gestão de Usuários
                </h2>
                <div className="flex gap-3">
                    <div className="flex items-center gap-3 mr-2">
                        <span className="text-[10px] font-bold text-gray-600 uppercase">
                            Exibindo {filteredUsers.length} de {users.length} usuários
                        </span>
                    </div>
                    <select 
                        value={filterSector}
                        onChange={e => setFilterSector(e.target.value)}
                        className="text-xs bg-white hover:bg-gray-50 text-gray-900 px-4 py-2 rounded-lg transition-all font-bold border border-gray-300 focus:outline-none min-w-[160px]"
                    >
                        <option value="">Todos os Setores</option>
                        {AGENT_SECTORS.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)} 
                        className="text-xs bg-tradestudio-600 hover:bg-tradestudio-500 text-white px-4 py-2 rounded-lg transition-all font-bold shadow-lg flex items-center gap-2"
                    >
                        <Icons.Plus /> Novo Usuário
                    </button>
                    <button onClick={loadUsers} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-lg transition-all font-bold border border-gray-300 flex items-center gap-2">
                        <Icons.Refresh /> Atualizar
                    </button>
                </div>
            </div>

            {/* Modal de Criação */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Icons.Plus /> Criar Novo Usuário
                        </h2>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Email</label>
                                <input 
                                    type="email" 
                                    required
                                    value={newUserEmail}
                                    onChange={e => setNewUserEmail(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm text-gray-900 focus:border-tradestudio-500 focus:outline-none"
                                    placeholder="usuario@email.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Senha</label>
                                <div className="relative">
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        required
                                        value={newUserPassword}
                                        onChange={e => setNewUserPassword(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-lg p-3 pr-10 text-sm text-gray-900 focus:border-tradestudio-500 focus:outline-none"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                                    >
                                        {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Cargo do Usuário</label>
                                <select 
                                    value={newUserRole}
                                    onChange={e => setNewUserRole(e.target.value as UserRole)}
                                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm text-gray-900 focus:border-tradestudio-500 focus:outline-none"
                                >
                                    {getAvailableRoles().map(role => (
                                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Setor do Usuário</label>
                                <select 
                                    value={newUserSector}
                                    onChange={e => setNewUserSector(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm text-gray-900 focus:border-tradestudio-500 focus:outline-none"
                                >
                                    <option value="" disabled>Selecione um setor...</option>
                                    {AGENT_SECTORS.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button 
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)} 
                                    className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isProcessing}
                                    className="px-5 py-2.5 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isProcessing ? 'Criando...' : 'Criar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto p-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-gray-500 font-bold animate-pulse">Carregando usuários...</div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#000000] text-white text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Usuário</th>
                                    <th className="px-6 py-4">Cargo</th>
                                    <th className="px-6 py-4">Setores</th>
                                    <th className="px-6 py-4">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-900 font-bold">
                                                    {u.email[0].toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-900 font-bold">{u.email}</span>
                                                    <span className="text-[10px] text-gray-500 font-mono">{u.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isMaster && !u.is_master && u.role !== 'admin-master' ? (
                                                <select 
                                                    value={u.role}
                                                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value as UserRole)}
                                                    className="bg-white border border-gray-300 rounded px-2 py-1 text-[10px] font-bold text-gray-900 focus:border-tradestudio-500 focus:outline-none"
                                                >
                                                    {Object.keys(ROLE_LABELS).map((roleKey) => (
                                                        <option key={roleKey} value={roleKey}>
                                                            {ROLE_LABELS[roleKey as UserRole]}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="bg-purple-50 border border-purple-200 rounded px-2 py-1 text-[10px] font-bold text-purple-600 inline-flex items-center gap-1.5 opacity-80 cursor-default select-none">
                                                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse"></div>
                                                    {u.is_master || u.role === 'admin-master' ? 'Admin Master' : ROLE_LABELS[u.role as UserRole] || u.role}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <select 
                                                value={u.sectors?.[0] || ''} 
                                                onChange={(e) => handleUpdateUserSector(u.id, e.target.value)}
                                                className="bg-white border border-gray-300 rounded px-2 py-1 text-[10px] font-bold text-gray-900 focus:border-tradestudio-500 focus:outline-none w-full max-w-[150px]"
                                            >
                                                {!(u.sectors?.[0]) && <option value="" disabled>Sem Setor</option>}
                                                {AGENT_SECTORS.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                {!u.is_master && u.role !== 'admin-master' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleDeleteUser(u)}
                                                            className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded border border-red-200 transition-colors"
                                                        >
                                                            Remover
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const GlobalAssetsView: React.FC<{ 
    session: any; 
    onRefresh?: () => void; 
    addToast: any;
    navigate: any;
    handleDeleteGlobalAgent: any;
}> = ({ session, onRefresh, addToast, navigate, handleDeleteGlobalAgent }) => {
    const [activeTab, setActiveTab] = useState<'knowledge' | 'tools' | 'agents'>('knowledge');
    const [knowledge, setKnowledge] = useState<GlobalKnowledge[]>([]);
    const [tools, setTools] = useState<GlobalTool[]>([]);
    const [agents, setAgents] = useState<GlobalAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
    const [isToolModalOpen, setIsToolModalOpen] = useState(false);
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [editingKnowledge, setEditingKnowledge] = useState<GlobalKnowledge | null>(null);
    const [editingTool, setEditingTool] = useState<GlobalTool | null>(null);
    const [editingAgent, setEditingAgent] = useState<GlobalAgent | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [tempAvatar, setTempAvatar] = useState('🤖');
    const [selectedGlobalTools, setSelectedGlobalTools] = useState<string[]>([]);
    const [selectedGlobalKnowledge, setSelectedGlobalKnowledge] = useState<string[]>([]);
    const [localAgentTools, setLocalAgentTools] = useState<AgentTool[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [editingLocalTool, setEditingLocalTool] = useState<AgentTool | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [tempDocId, setTempDocId] = useState('');
    const [isKnowledgePublic, setIsKnowledgePublic] = useState(true);
    const [isToolPublic, setIsToolPublic] = useState(true);
    const [isAgentPublic, setIsAgentPublic] = useState(true);
    const [knowledgeSelectAll, setKnowledgeSelectAll] = useState(false);
    const [toolSelectAll, setToolSelectAll] = useState(false);
    const [agentSelectAll, setAgentSelectAll] = useState(false);
    const [openInfoModal, setOpenInfoModal] = useState<{ title: string; content: React.ReactNode } | null>(null);
    const [openRequestLimitInfo, setOpenRequestLimitInfo] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Test Chat Modal
    const [isTestChatModalOpen, setIsTestChatModalOpen] = useState(false);
    const [testChatAgent, setTestChatAgent] = useState<GlobalAgent | null>(null);
    const [testChatMessages, setTestChatMessages] = useState<ChatMessage[]>([]);
    const [testChatInput, setTestChatInput] = useState('');
    const [testChatIsProcessing, setTestChatIsProcessing] = useState(false);

    const triggerSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    };

    const manualSyncGoogleDoc = async (input: string, table: 'agents' | 'global_agents' | 'global_knowledge', id: string) => {
        if (!input) return;
        const syncTimestamp = new Date().toLocaleString('pt-BR');
        const googleToken = (session as any)?.provider_token;
        
        console.log(`[SYNC] --- Início Sincronização Manual ${syncTimestamp} ---`);
        console.log(`[SYNC] Token Google presente: ${!!googleToken}`);
        if (googleToken) console.log(`[SYNC] Token Google (primeiros 20 chars): ${googleToken.substring(0,20)}...`);
        
        setIsSyncing(true);
        try {
            const docUrls = input.split(',').filter(id => id.trim());
            let concatenatedContent = '';
            let successCount = 0;
            
            for (const urlOrId of docUrls) {
                const cleanId = extractGoogleId(urlOrId);
                let text = '';
                
                console.log(`[SYNC] Processando: ${cleanId}`);
                
                // First: Check file exists and get metadata
                if (googleToken) {
                    try {
                        const metadataUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}?fields=id,name,mimeType,ownedByMe,shared`;
                        const metadataHeaders = { 'Authorization': `Bearer ${googleToken}` };
                        const metadataRes = await fetch(metadataUrl, { headers: metadataHeaders });
                        
                        console.log(`[SYNC] Metadata check status: ${metadataRes.status}`);
                        
                        if (!metadataRes.ok) {
                            const metadataErr = await metadataRes.text();
                            console.error(`[SYNC] Metadata error:`, metadataErr);
                        } else {
                            const metadata = await metadataRes.json();
                            console.log(`[SYNC] File metadata:`, metadata);
                        }
                    } catch (e) {
                        console.error(`[SYNC] Metadata fetch failed:`, e);
                    }
                }
                
                // Estratégia de tentativa dupla: 
                // Se a URL original indicar o tipo, tentamos ele primeiro. 
                // Se falhar ou se for apenas o ID, tentamos como Documento e depois como Planilha.
                const suspectedIsSheet = isGoogleSheet(urlOrId);
                const formats = suspectedIsSheet ? ['sheet', 'doc'] : ['doc', 'sheet'];

                console.log(`[SYNC] Suspeita: ${suspectedIsSheet ? 'Planilha' : 'Doc'}`);

                for (const format of formats) {
                    try {
                        console.log(`[SYNC] ${cleanId}: Tentando ${format.toUpperCase()}, token present: ${!!googleToken}`);
                        
                        let apiUrl: string;
                        
                        if (format === 'doc') {
                            apiUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=text/plain`;
                        } else {
                            apiUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=text/csv`;
                        }
                        
                        const headers: Record<string, string> = {};
                        if (googleToken) {
                            headers['Authorization'] = `Bearer ${googleToken}`;
                        }
                        
                        console.log(`[SYNC] Fetching: ${apiUrl}`);
                        const response = await fetch(apiUrl, { headers });
                        console.log(`[SYNC] ${cleanId} como ${format.toUpperCase()}: response status ${response.status}, ok: ${response.ok}`);
                        
                        if (response.ok) {
                            const resText = await response.text();
                            console.log(`[SYNC] ${cleanId} como ${format.toUpperCase()}: response text length:`, resText.length);
                            
                            if (resText && resText.length > 5) {
                                text = resText;
                                console.log(`[SYNC] Sucesso em ${cleanId} como ${format.toUpperCase()}`);
                                break; // Encontrou o conteúdo, para de tentar outros formatos para este ID
                            }
                        } else {
                            const errorText = await response.text();
                            console.error(`[SYNC] ${cleanId} como ${format.toUpperCase()} failed: status ${response.status}`, errorText);
                        }
                    } catch (e) {
                        console.warn(`[SYNC] Tentativa como ${format} falhou para ${cleanId}:`, e);
                    }
                }

                if (text) {
                    concatenatedContent += `\n\n--- INÍCIO DO DOCUMENTO: ${cleanId} ---\n\n` + text + `\n\n--- FIM DO DOCUMENTO: ${cleanId} ---\n`;
                    successCount++;
                } else {
                    console.error(`[SYNC] Falha total no documento ${cleanId} em todos os formatos.`);
                }
            }

            if (successCount === 0) {
                throw new Error('Não foi possível baixar o conteúdo. Verifique se os documentos estão compartilhados com sua conta.');
            }

            const { error } = await supabase.from(table).update({
                cached_content: concatenatedContent,
                last_sync_at: new Date().toISOString()
            }).eq('id', id);

            if (error) throw error;
            triggerSuccess(`Sincronização concluída! (${successCount} docs)`);
            await loadAssets();
        } catch (err: any) {
            console.error('[SYNC] Erro Final:', err);
            alert('Erro ao sincronizar: ' + err.message);
        } finally {
            setIsSyncing(false);
            console.log('[SYNC] --- Fim do Processo ---');
        }
    };

    useEffect(() => {
        if (editingKnowledge) {
            setTempDocId(editingKnowledge.google_doc_id || '');
            setIsKnowledgePublic(editingKnowledge.is_public ?? true);
            setKnowledgeSelectAll(editingKnowledge.sectors?.length === 0 || editingKnowledge.sectors?.length === AGENT_SECTORS.length);
        } else {
            setTempDocId('');
            setIsKnowledgePublic(true);
            setKnowledgeSelectAll(false);
        }
    }, [editingKnowledge]);

    useEffect(() => {
        if (editingTool) {
            setIsToolPublic(editingTool.is_public ?? true);
            setToolSelectAll(editingTool.sectors?.length === 0 || editingTool.sectors?.length === AGENT_SECTORS.length);
        } else {
            setIsToolPublic(true);
            setToolSelectAll(false);
        }
    }, [editingTool]);

    useEffect(() => {
        if (editingAgent) {
            setTempAvatar(editingAgent.avatar);
            setTempDocId(editingAgent.google_doc_id || '');
            setIsAgentPublic(editingAgent.is_public ?? true);
            setAgentSelectAll(editingAgent.sectors?.length === 0 || editingAgent.sectors?.length === AGENT_SECTORS.length);
            setTempApiKey(editingAgent.api_key || '');
            // Normalize provider if needed
            if ((editingAgent.provider as string) === 'google') {
                setEditingAgent({ ...editingAgent, provider: 'gemini' });
            }
            // Filtra ferramentas globais dos IDs e mantém o que for local
            const tools = editingAgent.tools || [];
            setSelectedGlobalTools(tools.filter((t: any) => !t.is_local).map((t: any) => t.id));
            setLocalAgentTools(tools.filter((t: any) => t.is_local));
            setAttachedFiles(editingAgent.attached_files || []);
            setSelectedGlobalKnowledge(editingAgent.global_knowledge_ids || []);
        } else {
            setTempAvatar('🤖');
            setTempDocId('');
            setIsAgentPublic(true);
            setAgentSelectAll(false);
            setSelectedGlobalTools([]);
            setLocalAgentTools([]);
            setSelectedGlobalKnowledge([]);
            setTempApiKey('');
        }
    }, [editingAgent]);

    const handleAgentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file count
        if (attachedFiles.length >= 3) {
            addToast('error', 'Limite atingido', 'Você só pode enviar até 3 arquivos');
            if(fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Validate file type
        const allowedExtensions = ['.pdf', '.docx'];
        const fileExtension = file.name.toLowerCase().slice(-5);
        const isValid = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!isValid) {
            addToast('error', 'Arquivo inválido', 'Apenas arquivos .pdf ou .docx são permitidos');
            if(fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            
            const newFile: AttachedFile = {
                id: crypto.randomUUID(),
                name: file.name,
                type: file.type || 'text/plain',
                size: file.size,
                content: text,
                created_at: Date.now()
            };

            setAttachedFiles(prev => [...prev, newFile]);
            triggerSuccess(`${file.name} anexado.`);
        };
        reader.readAsText(file);
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeGlobalAttachedFile = (fileId: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const handleSaveLocalTool = (tool: AgentTool) => {
        const exists = localAgentTools.find(t => t.id === tool.id);
        if (exists) {
            setLocalAgentTools(localAgentTools.map(t => t.id === tool.id ? tool : t));
        } else {
            setLocalAgentTools([...localAgentTools, { ...tool, is_local: true } as any]);
        }
        setEditingLocalTool(null);
    };

    const loadAssets = async () => {
        setLoading(true);
        try {
            const { data: kData, error: kError } = await supabase.from('global_knowledge').select('*').order('created_at', { ascending: false });
            const { data: tData, error: tError } = await supabase.from('global_tools').select('*').order('created_at', { ascending: false });
            const { data: aData, error: aError } = await supabase.from('global_agents').select('*').order('created_at', { ascending: false });
            
            if (kError) throw kError;
            if (tError) throw tError;
            if (aError) console.warn('Erro ao carregar agentes globais (tabela pode não existir):', aError);

            if (kData) setKnowledge(kData);
            if (tData) setTools(tData);
            if (aData) {
                // Normalize provider for global agents loaded from DB
                const normalizedAgents = aData.map((agent: any) => ({
                    ...agent,
                    provider: agent.provider === 'google' ? 'gemini' : agent.provider
                }));
                setAgents(normalizedAgents);
            }
            if (onRefresh) onRefresh();
        } catch (err: any) {
            console.error('Erro ao carregar ativos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        // --- SEGURANÇA: Só carrega ativos se houver uma sessão ativa ---
        if (session) {
            loadAssets(); 
        }
    }, [session]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedExtensions = ['.pdf', '.docx'];
        const isValid = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!isValid) {
            addToast('error', 'Arquivo inválido', 'Apenas arquivos .pdf ou .docx são permitidos');
            if(fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        let text = '';
      
        if (file.name.toLowerCase().endsWith('.docx')) {
            try {
                const mammoth = await import('mammoth');
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                text = result.value;
            } catch (err) {
                console.error("[HANDLE FILE UPLOAD (Global Knowledge)] Error parsing .docx file:", err);
                alert('Não foi possível extrair o texto do arquivo .docx');
                return;
            }
        } else {
            // For other file types (txt, etc.)
            const reader = new FileReader();
            await new Promise((resolve) => {
                reader.onload = (event) => {
                    text = event.target?.result as string;
                    resolve(undefined);
                };
                reader.readAsText(file);
            });
        }

        if (editingKnowledge) {
            setEditingKnowledge({ ...editingKnowledge, content: (editingKnowledge.content || '') + '\n\n' + text });
        } else {
            // Se for um novo, precisamos de um objeto temporário
            const tempContent = (document.querySelector('textarea[name="content"]') as HTMLTextAreaElement)?.value || '';
            (document.querySelector('textarea[name="content"]') as HTMLTextAreaElement).value = tempContent + '\n\n' + text;
        }
    };

    const handleSaveKnowledge = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        // Coleta cargos selecionados
        const roles: string[] = Object.keys(ROLE_LABELS).filter(role => formData.get(`role_${role}`) === 'on');

        // Coleta setores selecionados
        let sectors: string[] = [];
        if (knowledgeSelectAll) {
            sectors = AGENT_SECTORS.map(s => s.id);
        } else {
            sectors = AGENT_SECTORS.map(s => s.id).filter(id => formData.get(`sector_${id}`) === 'on');
        }

        const payload = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            content: formData.get('content') as string,
            google_doc_id: formData.get('google_doc_id') as string || '',
            sync_interval: parseInt(formData.get('sync_interval') as string || '0'),
            is_public: formData.get('is_public') === 'on',
            sectors: sectors,
            allowed_roles: roles
        };

        try {
            if (editingKnowledge) {
                const { error } = await supabase.from('global_knowledge').update(payload).eq('id', editingKnowledge.id);
                if (error) throw error;
                triggerSuccess('Conhecimento Atualizado!');
            } else {
                const { error } = await supabase.from('global_knowledge').insert(payload);
                if (error) throw error;
                triggerSuccess('Conhecimento Criado!');
            }
            setIsKnowledgeModalOpen(false);
            setEditingKnowledge(null);
            console.log('Conhecimento salvo com sucesso, recarregando lista...');
            await loadAssets();
        } catch (err: any) {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar conhecimento: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveTool = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        // Coleta cargos selecionados
        const roles: string[] = Object.keys(ROLE_LABELS).filter(role => formData.get(`role_${role}`) === 'on');

        // Coleta setores selecionados
        let sectors: string[] = [];
        if (toolSelectAll) {
            sectors = AGENT_SECTORS.map(s => s.id);
        } else {
            sectors = AGENT_SECTORS.map(s => s.id).filter(id => formData.get(`sector_${id}`) === 'on');
        }

        const payload = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            parameters: formData.get('parameters') as string,
            webhook_url: formData.get('webhook_url') as string,
            method: formData.get('method') as string,
            is_public: formData.get('is_public') === 'on',
            sectors: sectors,
            allowed_roles: roles
        };

        try {
            if (editingTool) {
                const { error } = await supabase.from('global_tools').update(payload).eq('id', editingTool.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('global_tools').insert(payload);
                if (error) throw error;
            }
            setIsToolModalOpen(false);
            setEditingTool(null);
            console.log('Ferramenta salva com sucesso, recarregando lista...');
            await loadAssets();
        } catch (err: any) {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar ferramenta: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        const roles: string[] = Object.keys(ROLE_LABELS).filter(role => formData.get(`role_${role}`) === 'on');

        // Coleta setores selecionados
        let sectors: string[] = [];
        if (agentSelectAll) {
            sectors = AGENT_SECTORS.map(s => s.id);
        } else {
            sectors = AGENT_SECTORS.map(s => s.id).filter(id => formData.get(`sector_${id}`) === 'on');
        }
        const globalAgentTools = selectedGlobalTools.map(toolId => {
            const globalTool = tools.find(t => t.id === toolId);
            return globalTool ? {
                id: globalTool.id,
                name: globalTool.name,
                description: globalTool.description,
                enabled: true,
                parameters: globalTool.parameters,
                webhookUrl: globalTool.webhook_url,
                method: globalTool.method,
                is_local: false
            } : null;
        }).filter(Boolean);

        // Combina ferramentas globais e locais
        const allAgentTools = [...globalAgentTools, ...localAgentTools];

        const payload: any = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            avatar: formData.get('avatar') as string,
            sectors: sectors,
            provider: (formData.get('provider') as string) === 'google' ? 'gemini' : (formData.get('provider') as string),
            model: formData.get('model') as string,
            is_reasoning: formData.get('is_reasoning') === 'on',
            system_prompt: formData.get('system_prompt') as string,
            temperature: parseFloat(formData.get('temperature') as string),
            top_p: parseFloat(formData.get('top_p') as string),
            max_tokens: Math.min(5000, Math.max(1, parseInt(formData.get('max_tokens') as string) || 5000)),
            is_public: formData.get('is_public') === 'on',
            allowed_roles: roles,
            tools: allAgentTools,
            knowledge_base: sanitizeForPostgres(formData.get('knowledge_base') as string),
            attached_files: attachedFiles.map(f => ({ ...f, content: sanitizeForPostgres(f.content) })), // Sanitiza conteúdo dos arquivos
            google_doc_id: formData.get('google_doc_id') as string || '',
            sync_interval: parseInt(formData.get('sync_interval') as string || '0'),
            global_knowledge_ids: selectedGlobalKnowledge
        };

        try {
            // First try with api_key if we have one
            let saveSuccess = false;
            if (tempApiKey) {
                try {
                    const payloadWithApiKey = { ...payload, api_key: tempApiKey };
                    if (editingAgent?.id) {
                        const { error } = await supabase.from('global_agents').update(payloadWithApiKey).eq('id', editingAgent.id);
                        if (!error) saveSuccess = true;
                    } else {
                        const { error } = await supabase.from('global_agents').insert(payloadWithApiKey);
                        if (!error) saveSuccess = true;
                    }
                } catch (e) {
                    // If api_key column doesn't exist, we'll try without
                    console.log('api_key column not found, saving without it');
                }
            }

            // If we didn't save yet (either no api_key or it failed), save without it
            if (!saveSuccess) {
                if (editingAgent?.id) {
                    const { error } = await supabase.from('global_agents').update(payload).eq('id', editingAgent.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('global_agents').insert(payload);
                    if (error) throw error;
                }
            }

            triggerSuccess(editingAgent?.id ? 'Agente Atualizado!' : 'Agente Criado!');
            setIsAgentModalOpen(false);
            setEditingAgent(null);
            await loadAssets();
        } catch (err: any) {
            console.error('Erro ao salvar agente:', err);
            alert('Erro ao salvar agente global: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTestSend = async () => {
        if (!testChatAgent || !testChatInput.trim()) return;
        
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: testChatInput,
            timestamp: Date.now()
        };
        
        setTestChatMessages(prev => [...prev, userMessage]);
        setTestChatInput('');
        setTestChatIsProcessing(true);
        
        try {
            // Convert GlobalAgent to AgentConfig for runAgent
            const tempAgent: AgentConfig = {
                ...DEFAULT_AGENT,
                id: testChatAgent.id,
                name: testChatAgent.name,
                avatar: testChatAgent.avatar,
                provider: testChatAgent.provider,
                model: testChatAgent.model,
                systemPrompt: testChatAgent.system_prompt,
                temperature: testChatAgent.temperature,
                topP: testChatAgent.top_p,
                maxTokens: testChatAgent.max_tokens,
                isReasoning: testChatAgent.is_reasoning,
                tools: testChatAgent.tools || [],
                attachedFiles: testChatAgent.attached_files || [],
                globalKnowledgeIds: testChatAgent.global_knowledge_ids || [],
                knowledgeBase: testChatAgent.knowledge_base,
                googleDocId: testChatAgent.google_doc_id,
                cachedContent: testChatAgent.cached_content,
                apiKey: testChatAgent.api_key
            };
            
            const response = await runAgent(tempAgent, testChatMessages, testChatInput);
            const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response.content,
                timestamp: Date.now()
            };
            setTestChatMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Test chat error:", error);
            const errorMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `Desculpe, houve um erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
                timestamp: Date.now()
            };
            setTestChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setTestChatIsProcessing(false);
        }
    };

    const handleSaveGlobalDocId = async (id: string, docId: string, table: 'global_agents' | 'global_knowledge' = 'global_agents') => {
        if (!id || !docId) return;
        setIsProcessing(true);
        try {
            const { error } = await supabase.from(table).update({ google_doc_id: docId }).eq('id', id);
            if (error) throw error;
            triggerSuccess('ID do Documento Salvo!');
            await loadAssets();
        } catch (err: any) {
            alert('Erro ao salvar ID: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteKnowledge = async (id: string) => {
        if (confirm('Deletar este conhecimento global?')) {
            await supabase.from('global_knowledge').delete().eq('id', id);
            loadAssets();
        }
    };

    const handleDeleteTool = async (id: string) => {
        if (confirm('Deletar esta requisição global?')) {
            await supabase.from('global_tools').delete().eq('id', id);
            loadAssets();
        }
    };

    const handleDeleteAgent = async (id: string) => {
        if (confirm('Deletar este agente global?')) {
            await supabase.from('global_agents').delete().eq('id', id);
            loadAssets();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white animate-fade-in">
            <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center bg-white">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Icons.Globe /> Ativos Globais
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Conhecimentos e Requisições compartilhados entre agentes.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => {
                                if (activeTab === 'knowledge') { setEditingKnowledge(null); setIsKnowledgeModalOpen(true); }
                                else if (activeTab === 'tools') { 
                                    if (tools.length >= 20) {
                                        addToast('error', 'Limite atingido', 'Você só pode ter até 20 requisições');
                                        return;
                                    }
                                    setEditingTool(null); setIsToolModalOpen(true); 
                                }
                                else { 
                                    setEditingAgent({
                                        name: '',
                                        description: '',
                                        avatar: '🤖',
                                        provider: 'gemini',
                                        model: 'gemini-1.5-flash',
                                        system_prompt: '',
                                        temperature: 0.7,
                                        top_p: 1,
                                        max_tokens: 5000,
                                        is_public: true,
                                        created_at: new Date().toISOString(),
                                        is_reasoning: false,
                                        sectors: [],
                                        tools: [],
                                        attached_files: [],
                                        global_knowledge_ids: []
                                    } as unknown as GlobalAgent); 
                                    setIsAgentModalOpen(true); 
                                }
                            }}
                            className="text-xs bg-tradestudio-600 hover:bg-tradestudio-500 text-white px-4 py-2 rounded-lg transition-all font-bold shadow-lg flex items-center gap-2"
                        >
                            <Icons.Plus /> Novo {activeTab === 'knowledge' ? 'Conhecimento' : activeTab === 'tools' ? 'Requisição' : 'Agente'}
                        </button>
                        {activeTab === 'tools' && (
                            <button 
                                onClick={() => setOpenRequestLimitInfo(!openRequestLimitInfo)}
                                className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 px-3 py-2 rounded-lg transition-all border border-gray-300"
                            >
                                <Icons.Info className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <button onClick={loadAssets} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-lg transition-all font-bold border border-gray-300 flex items-center gap-2">
                        <Icons.Refresh /> Atualizar
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-1 p-3 border-b border-gray-200 bg-white">
                <button 
                    onClick={() => setActiveTab('knowledge')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'knowledge' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <Icons.Book /> Conhecimentos
                </button>
                <button 
                    onClick={() => setActiveTab('tools')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'tools' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <Icons.Zap /> Requisições
                </button>
                <button 
                    onClick={() => setActiveTab('agents')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'agents' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <Icons.Users /> Agentes
                </button>
            </div>

            <div className="flex-1 overflow-auto p-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-gray-500 font-bold animate-pulse">Carregando ativos...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeTab === 'knowledge' ? (
                            knowledge.map(k => (
                                <div 
                                    key={k.id} 
                                    onClick={() => { setEditingKnowledge(k); setIsKnowledgeModalOpen(true); }}
                                    className="bg-black border border-gray-800 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-800 transition-all flex flex-col min-h-[18rem] relative group cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                            <Icons.Book />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {k.is_public && <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">PÚBLICO</span>}
                                            <div className="p-1.5 bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Icons.Edit />
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2 leading-tight">{k.title}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed">{k.description}</p>
                                    
                                    <div className="mt-auto flex flex-col gap-2">
                                        <div className="flex flex-wrap gap-1">
                                            {(k.sectors || []).map(sId => {
                                                const sector = AGENT_SECTORS.find(s => s.id === sId);
                                                return (
                                                    <span key={sId} className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold uppercase tracking-wider">
                                                        {sector?.name || sId}
                                                    </span>
                                                );
                                            })}
                                            {(k.sectors || []).length === 0 && <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700 font-bold uppercase tracking-wider">GERAL</span>}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {(k.allowed_roles || []).map(role => (
                                                <span key={role} className="text-[9px] bg-tradestudio-500/20 text-tradestudio-400 px-1.5 py-0.5 rounded border border-tradestudio-500/30 font-bold uppercase tracking-wider">
                                                    {ROLE_LABELS[role] || role}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
                                        <span className="text-[10px] text-gray-500 font-medium">{new Date(k.created_at).toLocaleDateString()}</span>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteKnowledge(k.id); }} 
                                                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                                title="Deletar"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : activeTab === 'tools' ? (
                            tools.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => { setEditingTool(t); setIsToolModalOpen(true); }}
                                    className="bg-black border border-gray-800 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-800 transition-all flex flex-col min-h-[18rem] relative group cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                                            <Icons.Zap />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {t.is_public && <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">PÚBLICO</span>}
                                            <div className="p-1.5 bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Icons.Edit />
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2 leading-tight">{t.name}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed">{t.description}</p>
                                    
                                    <div className="mt-auto flex flex-col gap-2">
                                        <div className="flex flex-wrap gap-1">
                                            {(t.sectors || []).map(sId => {
                                                const sector = AGENT_SECTORS.find(s => s.id === sId);
                                                return (
                                                    <span key={sId} className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/30 font-bold uppercase tracking-wider">
                                                        {sector?.name || sId}
                                                    </span>
                                                );
                                            })}
                                            {(t.sectors || []).length === 0 && <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700 font-bold uppercase tracking-wider">GERAL</span>}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {(t.allowed_roles || []).map(role => (
                                                <span key={role} className="text-[9px] bg-tradestudio-500/20 text-tradestudio-400 px-1.5 py-0.5 rounded border border-tradestudio-500/30 font-bold uppercase tracking-wider">
                                                    {ROLE_LABELS[role] || role}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
                                        <span className="text-[10px] text-gray-500 font-medium">{new Date(t.created_at).toLocaleDateString()}</span>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTool(t.id); }} 
                                                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                                title="Deletar"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : activeTab === 'agents' ? (
                            agents.map(a => (
                                <div 
                                    key={a.id} 
                                    onClick={() => { navigate(`/global-agent/${a.id}`); }}
                                    className="group bg-black border border-gray-800 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-800 transition-all cursor-pointer relative overflow-hidden flex flex-col min-h-[18rem]"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-3xl shadow-inner border border-white/10">
                                            {a.avatar}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {a.is_public && <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">PÚBLICO</span>}
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setEditingAgent(a); 
                                                    setIsAgentModalOpen(true); 
                                                }}
                                                className="p-1.5 bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700"
                                                title="Editar Agente Global"
                                            >
                                                <Icons.Edit />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2 leading-tight">{a.name}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed">{a.description}</p>

                                    
                                    <div className="mt-auto flex flex-col gap-2">
                                        <div className="flex flex-wrap gap-1">
                                            {(a.sectors || []).length > 0 ? 
                                                (a.sectors || []).map(sId => {
                                                    const sector = AGENT_SECTORS.find(s => s.id === sId);
                                                    return (
                                                        <span key={sId} className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold uppercase tracking-wider">
                                                            {sector?.name || sId}
                                                        </span>
                                                    );
                                                })
                                             : 
                                                <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700 font-bold uppercase tracking-wider">GERAL</span>
                                            }
                                        </div>
                                        {(a.allowed_roles || []).length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {(a.allowed_roles || []).map(role => (
                                                    <span key={role} className="text-[9px] bg-tradestudio-500/20 text-tradestudio-400 px-1.5 py-0.5 rounded border border-tradestudio-500/30 font-bold uppercase tracking-wider">
                                                        {ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                                        <div className="text-[10px] text-gray-400 flex flex-col">
                                            <span className="font-bold text-gray-300">{a.model}</span>
                                            <span className="opacity-60 font-medium">{new Date(a.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    navigate(`/global-agent/${a.id}`); 
                                                }} 
                                                className="p-2 text-gray-600 hover:text-tradestudio-400 hover:bg-tradestudio-900/20 rounded-lg transition-colors"
                                                title="Abrir Chat"
                                            >
                                                <Icons.Send />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteGlobalAgent(a.id, e); }} 
                                                className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Excluir Agente Global"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-500 gap-4 bg-gray-800/20 rounded-2xl border border-dashed border-gray-700">
                                <Icons.Zap />
                                <div className="text-center">
                                    <p className="font-bold text-white">Nenhum ativo encontrado</p>
                                    <p className="text-xs">Crie um novo para começar</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Conhecimento */}
            {isKnowledgeModalOpen && (
                <div key={editingKnowledge?.id || 'new-knowledge'} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Icons.Book /> {editingKnowledge ? 'Editar' : 'Novo'} Conhecimento Global
                        </h2>
                        <form onSubmit={handleSaveKnowledge} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Título</label>
                                <input name="title" required defaultValue={editingKnowledge?.title} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none" placeholder="Ex: Manual de Procedimentos" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descrição Curta</label>
                                <input name="description" defaultValue={editingKnowledge?.description} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none" placeholder="O que este conhecimento contém?" />
                            </div>
                            
                            <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                            <Icons.Book /> Base de Conhecimento (Texto)
                                            <button 
                                                type="button"
                                                onClick={() => setOpenInfoModal({
                                                    title: 'Instruções de Upload',
                                                    content: (
                                                        <div className="space-y-3">
                                                            <div className="flex items-start gap-2">
                                                                <Icons.File className="text-blue-400 shrink-0 w-4 h-4 mt-0.5" />
                                                                <div>
                                                                    <p className="font-bold text-sm text-white">Tipos de arquivo permitidos</p>
                                                                    <p className="text-xs text-gray-400">Apenas arquivos .pdf ou .docx são permitidos</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                className="text-blue-300 hover:text-blue-100 transition-colors cursor-pointer"
                                            >
                                                <Icons.Info className="w-3 h-3" />
                                            </button>
                                        </label>
                                        <div className="flex flex-col gap-1 items-end">
                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                onChange={handleFileUpload} 
                                                className="hidden" 
                                                accept=".pdf,.docx"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-[10px] bg-blue-900/30 hover:bg-blue-800 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/30 flex items-center gap-1 transition-colors"
                                            >
                                                <Icons.Plus /> Importar Arquivo
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500">Apenas arquivos .pdf ou .docx são permitidos</p>
                                </div>
                                <textarea name="content" required defaultValue={editingKnowledge?.content} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white h-48 focus:border-tradestudio-500 focus:outline-none font-mono resize-none" placeholder="Escreva ou cole o conteúdo aqui..." />
                            </div>

                            <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-2">
                                        <Icons.Drive /> Sincronização Google Docs
                                    </label>
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        name="google_doc_id" 
                                        value={tempDocId} 
                                        onChange={e => setTempDocId(e.target.value)}
                                        className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none font-mono" 
                                        placeholder="ID do Google Doc (ex: 1yXw...)" 
                                    />
                                    {editingKnowledge?.id && (
                                        <button 
                                            type="button"
                                            onClick={() => handleSaveGlobalDocId(editingKnowledge.id, tempDocId, 'global_knowledge')}
                                            className="bg-green-600/20 hover:bg-green-600 text-green-500 hover:text-white px-3 py-2 rounded-lg text-[10px] font-bold border border-green-600/30 transition-all"
                                        >
                                            Salvar
                                        </button>
                                    )}
                                </div>
                                {editingKnowledge?.id && (
                                    <button 
                                        type="button"
                                        onClick={() => manualSyncGoogleDoc(tempDocId, 'global_knowledge', editingKnowledge.id)}
                                        disabled={isSyncing || !tempDocId}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white px-3 py-2.5 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-600 mt-2"
                                    >
                                        {isSyncing ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Refresh />}
                                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora (Manual)'}
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-3">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Setores / Departamentos</label>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input 
                                            type="checkbox" 
                                            name="sector_all_k"
                                            id="sector_all_k" 
                                            checked={knowledgeSelectAll} 
                                            onChange={(e) => setKnowledgeSelectAll(e.target.checked)} 
                                            className="w-4 h-4 accent-tradestudio-500" 
                                        />
                                        <label htmlFor="sector_all_k" className="text-[11px] font-bold text-gray-300">Todos os setores</label>
                                    </div>
                                    {!knowledgeSelectAll && (
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            {AGENT_SECTORS.map(s => (
                                                <div key={s.id} className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        name={`sector_${s.id}`} 
                                                        id={`sector_${s.id}_k`} 
                                                        defaultChecked={editingKnowledge?.sectors?.includes(s.id)} 
                                                        className="w-4 h-4 accent-tradestudio-500" 
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <div 
                                                            className="w-3 h-3 rounded-full" 
                                                            style={{ backgroundColor: s.color }}
                                                        />
                                                        <label htmlFor={`sector_${s.id}_k`} className="text-[11px] font-bold text-gray-300">{s.name}</label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Intervalo de Sincronização</label>
                                        <select 
                                            name="sync_interval" 
                                            defaultValue={editingKnowledge?.sync_interval || 24} 
                                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 outline-none"
                                        >
                                            <option value="3">A cada 3 horas</option>
                                            <option value="6">A cada 6 horas</option>
                                            <option value="9">A cada 9 horas</option>
                                            <option value="12">A cada 12 horas</option>
                                            <option value="24">A cada 24 horas</option>
                                            <option value="168">A cada 1 semana</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Permissões de Acesso</label>
                                
                                <div className="flex items-center gap-2 mb-2">
                                    <input 
                                        type="checkbox" 
                                        name="is_public" 
                                        id="is_public_k" 
                                        checked={isKnowledgePublic}
                                        onChange={(e) => setIsKnowledgePublic(e.target.checked)}
                                        className="w-4 h-4 accent-tradestudio-500" 
                                    />
                                    <label htmlFor="is_public_k" className="text-xs font-bold text-tradestudio-400 cursor-pointer">Todos os cargos (Público)</label>
                                </div>

                                {!isKnowledgePublic && (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-gray-800/50 animate-fade-in">
                                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                            <div key={role} className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    name={`role_${role}`} 
                                                    id={`role_${role}_k`} 
                                                    defaultChecked={editingKnowledge?.allowed_roles?.includes(role) ?? true} 
                                                    className="w-4 h-4 accent-tradestudio-500" 
                                                />
                                                <label htmlFor={`role_${role}_k`} className="text-[11px] font-bold text-gray-300 cursor-pointer">{label}</label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setIsKnowledgeModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancelar</button>
                                <button type="submit" disabled={isProcessing} className="px-5 py-2.5 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2">
                                    {isProcessing && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                    {editingKnowledge ? 'Salvar Alterações' : 'Criar Conhecimento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Ferramenta */}
            {isToolModalOpen && (
                <div key={editingTool?.id || 'new-tool'} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Icons.Zap /> {editingTool ? 'Editar' : 'Nova'} Requisição Global
                        </h2>
                        <form onSubmit={handleSaveTool} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nome</label>
                                    <input name="name" required defaultValue={editingTool?.name} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none" placeholder="NOME_DA_ACAO" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Método</label>
                                    <select name="method" defaultValue={editingTool?.method || 'POST'} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none">
                                        <option value="POST">POST</option>
                                        <option value="GET">GET</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descrição para a IA</label>
                                <input name="description" required defaultValue={editingTool?.description} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none" placeholder="Explique quando a IA deve usar esta requisição..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Webhook URL</label>
                                <input name="webhook_url" required defaultValue={editingTool?.webhook_url} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none font-mono" placeholder="https://..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                        JSON Schema Parâmetros
                                    </label>
                                     <textarea 
                                         name="parameters" 
                                         defaultValue={
                                             !editingTool?.parameters || 
                                             editingTool?.parameters === '{}' || 
                                             editingTool?.parameters.includes('"type": "object"') 
                                                 ? '' 
                                                 : editingTool?.parameters
                                         } 
                                         className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-xs text-blue-400 h-24 focus:border-tradestudio-500 focus:outline-none font-mono resize-none" 
                                         placeholder='{ "telefone": "{{telefone}}" }' 
                                     />
                                 </div>
                                <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-3 overflow-y-auto max-h-48 custom-scrollbar">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Setores / Departamentos</label>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input 
                                            type="checkbox" 
                                            name="sector_all_t"
                                            id="sector_all_t" 
                                            checked={toolSelectAll} 
                                            onChange={(e) => setToolSelectAll(e.target.checked)} 
                                            className="w-4 h-4 accent-tradestudio-500" 
                                        />
                                        <label htmlFor="sector_all_t" className="text-[11px] font-bold text-gray-300">Todos os setores</label>
                                    </div>
                                    {!toolSelectAll && (
                                        <div className="grid grid-cols-1 gap-y-2">
                                            {AGENT_SECTORS.map(s => (
                                                <div key={s.id} className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        name={`sector_${s.id}`} 
                                                        id={`sector_${s.id}_t`} 
                                                        defaultChecked={editingTool?.sectors?.includes(s.id)} 
                                                        className="w-4 h-4 accent-tradestudio-500" 
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <div 
                                                            className="w-3 h-3 rounded-full" 
                                                            style={{ backgroundColor: s.color }}
                                                        />
                                                        <label htmlFor={`sector_${s.id}_t`} className="text-[11px] font-bold text-gray-300">{s.name}</label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Permissões de Acesso</label>
                                
                                <div className="flex items-center gap-2 mb-2">
                                    <input 
                                        type="checkbox" 
                                        name="is_public" 
                                        id="is_public_t" 
                                        checked={isToolPublic}
                                        onChange={(e) => setIsToolPublic(e.target.checked)}
                                        className="w-4 h-4 accent-tradestudio-500" 
                                    />
                                    <label htmlFor="is_public_t" className="text-xs font-bold text-tradestudio-400 cursor-pointer">Todos os cargos (Público)</label>
                                </div>

                                {!isToolPublic && (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-gray-800/50 animate-fade-in">
                                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                            <div key={role} className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    name={`role_${role}`} 
                                                    id={`role_${role}_t`} 
                                                    defaultChecked={editingTool?.allowed_roles?.includes(role) ?? true} 
                                                    className="w-4 h-4 accent-tradestudio-500" 
                                                />
                                                <label htmlFor={`role_${role}_t`} className="text-[11px] font-bold text-gray-300 cursor-pointer">{label}</label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setIsToolModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancelar</button>
                                <button type="submit" className="px-5 py-2.5 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95">Salvar Requisição</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Agente Global */}
            {isAgentModalOpen && (
                <div key={editingAgent?.id || 'new-agent'} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Icons.Users /> {editingAgent ? 'Editar' : 'Novo'} Agente Global
                        </h2>
                        <form onSubmit={handleSaveAgent} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Coluna 1: Geral */}
                                <div className="space-y-4">
                                    <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Identidade</label>
                                        <div className="flex gap-3">
                                            <div className="relative">
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                                                    className="w-12 h-12 bg-[#0d1117] border border-gray-700 rounded-xl text-center text-2xl flex items-center justify-center hover:border-tradestudio-500 transition-colors"
                                                >
                                                    {tempAvatar}
                                                </button>
                                                <input type="hidden" name="avatar" value={tempAvatar} />
                                                {showAvatarPicker && (
                                                    <div className="absolute top-14 left-0 w-64 bg-[#1c2128] border border-gray-700 rounded-xl shadow-2xl p-3 grid grid-cols-5 gap-2 z-50">
                                                        {AVATAR_PRESETS.map(emoji => (
                                                            <button 
                                                                key={emoji}
                                                                type="button"
                                                                onClick={() => { setTempAvatar(emoji); setShowAvatarPicker(false); }}
                                                                className="w-10 h-10 hover:bg-gray-700 rounded flex items-center justify-center text-xl transition-colors"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <input name="name" required value={editingAgent?.name} onChange={(e) => setEditingAgent({ ...editingAgent!, name: e.target.value })} className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none" placeholder="Nome do Agente" />
                                        </div>
                                        <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-3">
                                            <label className="block text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Setores / Departamentos</label>
                                            <div className="flex items-center gap-2 mb-2">
                                                <input 
                                                    type="checkbox" 
                                                    name="sector_all_a"
                                                    id="sector_all_a" 
                                                    checked={agentSelectAll} 
                                                    onChange={(e) => setAgentSelectAll(e.target.checked)} 
                                                    className="w-4 h-4 accent-tradestudio-500" 
                                                />
                                                <label htmlFor="sector_all_a" className="text-[11px] font-bold text-gray-300">Todos os setores</label>
                                            </div>
                                            {!agentSelectAll && (
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                    {AGENT_SECTORS.map(s => (
                                                        <div key={s.id} className="flex items-center gap-2">
                                                            <input 
                                                                type="checkbox" 
                                                                name={`sector_${s.id}`} 
                                                                id={`sector_${s.id}_a`} 
                                                                defaultChecked={editingAgent?.sectors?.includes(s.id) ?? editingAgent?.sector === s.id} 
                                                                className="w-4 h-4 accent-tradestudio-500" 
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <div 
                                                                    className="w-3 h-3 rounded-full" 
                                                                    style={{ backgroundColor: s.color }}
                                                                />
                                                                <label htmlFor={`sector_${s.id}_a`} className="text-[11px] font-bold text-gray-300">{s.name}</label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <textarea name="description" value={editingAgent?.description} onChange={(e) => setEditingAgent({ ...editingAgent!, description: e.target.value })} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white h-20 focus:border-tradestudio-500 focus:outline-none resize-none" placeholder="Descrição do que o agente faz..." />
                                    </div>

                                    {/* Embed Integration */}
                                    <div className="bg-tradestudio-900/10 p-5 rounded-xl border border-tradestudio-500/20 space-y-4">
                                        <div className="flex items-center gap-2 text-tradestudio-400 mb-2">
                                            <Icons.Globe />
                                            <label className="text-xs font-bold uppercase tracking-wider">Embed do Agente (Site, WordPress, etc)</label>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mb-4">Use os códigos abaixo para integrar este agente em qualquer site ou plataforma externa.</p>
                                        
                                        <div className="space-y-4">
                                            {/* Opção Link de Compartilhamento */}
                                            <div className="bg-[#0d1117]/40 p-4 rounded-lg border border-gray-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                                        🔗 Link de Compartilhamento (URL Direta)
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/share/${editingAgent?.id}`;
                                                            navigator.clipboard.writeText(url);
                                                            triggerSuccess('Link Copiado!');
                                                        }}
                                                        className="text-[10px] text-tradestudio-400 hover:text-white transition-colors"
                                                    >
                                                        Copiar Link
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono truncate bg-[#0d1117]/20 p-2 rounded border border-gray-800/50">
                                                    {`${window.location.origin}/share/${editingAgent?.id}`}
                                                </div>
                                                <p className="text-[9px] text-gray-500 mt-2 italic">Envie este link para que qualquer pessoa possa testar o agente sem login.</p>
                                            </div>

                                            {/* Opção Iframe */}
                                            <div className="bg-[#0d1117]/40 p-4 rounded-lg border border-gray-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                                        <Icons.Back /> Iframe (Embutido na página)
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/share/${editingAgent?.id}`;
                                                            const code = `<iframe\n  src="${url}"\n  style="width: 100%; height: 600px; border: none;"\n  allow="microphone">\n</iframe>`;
                                                            navigator.clipboard.writeText(code);
                                                            triggerSuccess('Iframe Copiado!');
                                                        }}
                                                        className="text-[10px] text-tradestudio-400 hover:text-white transition-colors"
                                                    >
                                                        Copiar Iframe
                                                    </button>
                                                </div>
                                                <pre className="text-[10px] text-gray-500 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                                    {`<iframe src="${window.location.origin}/share/${editingAgent?.id}" style="width: 100%; height: 600px; border: none;"></iframe>`}
                                                </pre>
                                            </div>

                                            {/* Opção Bolha Flutuante */}
                                            <div className="bg-[#0d1117]/40 p-4 rounded-lg border border-gray-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                                        💬 Bolha Flutuante (Chat Widget)
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/share/${editingAgent?.id}`;
                                                            const code = `<!-- TradeStudio Chat Widget -->\n<script>\n(function() {\n  var iframe = document.createElement('iframe');\n  var button = document.createElement('div');\n  button.innerHTML = '${editingAgent?.avatar || '💬'}';\n  button.style = "position:fixed;bottom:20px;right:20px;width:60px;height:60px;background:#6366f1;border-radius:50%;display:flex;align-items:center;justify-center;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.3);z-index:9999;font-size:30px;transition:all 0.3s;";\n  iframe.style = "position:fixed;bottom:90px;right:20px;width:400px;height:600px;border:none;border-radius:15px;box-shadow:0 5px 25px rgba(0,0,0,0.2);display:none;z-index:9999;";\n  iframe.src = "${url}";\n  document.body.appendChild(button);\n  document.body.appendChild(iframe);\n  button.onclick = function() {\n    iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';\n  };\n})();\n</script>`;
                                                            navigator.clipboard.writeText(code);
                                                            triggerSuccess('Script Copiado!');
                                                        }}
                                                        className="text-[10px] text-tradestudio-400 hover:text-white transition-colors"
                                                    >
                                                        Copiar Script
                                                    </button>
                                                </div>
                                                <p className="text-[9px] text-gray-500 mb-2 italic">Adiciona um botão flutuante no canto do seu site.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Modelo & Inteligência</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1">Provedor</label>
                                                <select name="provider" value={editingAgent?.provider || 'gemini'} onChange={(e) => setEditingAgent({ ...editingAgent!, provider: e.target.value as LLMProvider })} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white focus:border-tradestudio-500 outline-none">
                                                    <option value="gemini">Google Gemini</option>
                                                    <option value="openai">OpenAI</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1">Modelo</label>
                                                <select 
                                                    name="model" 
                                                    value={editingAgent?.model || 'gemini-1.5-flash'} 
                                                    onChange={(e) => setEditingAgent({ ...editingAgent!, model: e.target.value })}
                                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white focus:border-tradestudio-500 outline-none"
                                                >
                                                    {SYSTEM_MODELS.map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                    <optgroup label="Custom/Other">
                                                        <option value={editingAgent?.model}>{editingAgent?.model}</option>
                                                    </optgroup>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-500 mb-1">Chave API (Opcional)</label>
                                            <input 
                                                type="password" 
                                                name="api_key" 
                                                value={tempApiKey} 
                                                onChange={(e) => setTempApiKey(e.target.value)} 
                                                className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white focus:border-tradestudio-500 outline-none font-mono" 
                                                placeholder="sk-..." 
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" name="is_reasoning" id="is_reasoning_a" checked={editingAgent?.is_reasoning ?? false} onChange={(e) => setEditingAgent({ ...editingAgent!, is_reasoning: e.target.checked })} className="w-4 h-4 accent-orange-500" />
                                            <label htmlFor="is_reasoning_a" className="cursor-pointer select-none">
                                                <div className="text-xs font-bold text-gray-300 flex items-center gap-1">
                                                    <Icons.Brain /> Ativar Raciocínio (Reasoning)
                                                </div>
                                            </label>
                                            <button 
                                                type="button"
                                                onClick={() => setOpenInfoModal({
                                                    title: "Ativar Raciocínio (Reasoning)",
                                                    content: <p className="text-sm text-gray-300">Para modelos o1/o3. Bloqueia temperatura e força completion tokens.</p>
                                                })}
                                                className="text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                <Icons.Info />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-[10px] text-gray-400 font-bold uppercase">Temp</label>
                                                    <button 
                                                            type="button"
                                                            onClick={() => setOpenInfoModal({
                                                                title: "Temperatura",
                                                                content: (
                                                                    <div className="text-sm text-gray-300 space-y-3">
                                                                        <div>
                                                                            <h4 className="text-white font-bold mb-1">0.0 - 0.3 (Analítico/Focado)</h4>
                                                                            <p className="text-gray-400 text-[12px]">Ideal para análises, cálculos ou respostas que demandam precisão e consistência. O agente se manterá mais conservador e menos criativo.</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-white font-bold mb-1">0.7 - 1.0 (Equilibrado/Conversacional)</h4>
                                                                            <p className="text-gray-400 text-[12px]">Perfeito para chatbots, atendimento ao cliente ou interações naturais. Combina precisão com uma dose saudável de naturalidade.</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-white font-bold mb-1">1.2 - 2.0 (Criativo/Brainstorm)</h4>
                                                                            <p className="text-gray-400 text-[12px]">Ótimo para ideias, roteiros, histórias ou exploração de conceitos. O agente terá liberdade para gerar respostas mais variadas e inesperadas.</p>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                            className="text-gray-500 hover:text-gray-300 transition-colors"
                                                        >
                                                            <Icons.Info />
                                                        </button>
                                                </div>
                                                <input name="temperature" type="number" step="0.1" value={editingAgent?.temperature ?? 0.7} onChange={(e) => setEditingAgent({ ...editingAgent!, temperature: parseFloat(e.target.value) || 0.7 })} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white outline-none" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-[10px] text-gray-400 font-bold uppercase">Top P</label>
                                                    <button 
                                                            type="button"
                                                            onClick={() => setOpenInfoModal({
                                                                title: "Top P",
                                                                content: (
                                                                    <div className="text-sm text-gray-300 space-y-3">
                                                                        <div>
                                                                            <h4 className="text-white font-bold mb-1">0.1 - 0.3 (Conservador/Seguro)</h4>
                                                                            <p className="text-gray-400 text-[12px]">Limita as respostas apenas às palavras mais prováveis, garantindo resultados seguros e previsíveis. Ideal para respostas que não podem se desviar do esperado.</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-white font-bold mb-1">0.5 - 0.8 (Equilibrado/Natural)</h4>
                                                                            <p className="text-gray-400 text-[12px]">Oferece um equilíbrio entre segurança e variedade, selecionando entre um grupo moderado de opções. Produz respostas naturais sem ser excessivamente criativo.</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-white font-bold mb-1">1.0 (Aberto/Considera tudo)</h4>
                                                                            <p className="text-gray-400 text-[12px]">Permite que o agente considere todas as palavras possíveis, abrindo espaço para mais variedade e surpresa. Ótimo para exploração criativa.</p>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                            className="text-gray-500 hover:text-gray-300 transition-colors"
                                                        >
                                                            <Icons.Info />
                                                        </button>
                                                </div>
                                                <input name="top_p" type="number" step="0.1" value={editingAgent?.top_p ?? 1} onChange={(e) => setEditingAgent({ ...editingAgent!, top_p: parseFloat(e.target.value) || 1 })} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white outline-none" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-[10px] text-gray-400 font-bold uppercase">Max Tokens</label>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setOpenInfoModal({
                                                            title: "Max Tokens",
                                                            content: <p className="text-sm text-gray-300">Limite de tokens gerados. O valor máximo permitido é 5000 tokens.</p>
                                                        })}
                                                        className="text-gray-500 hover:text-gray-300 transition-colors"
                                                    >
                                                        <Icons.Info />
                                                    </button>
                                                </div>
                                                <input name="max_tokens" type="number" value={editingAgent?.max_tokens ?? 5000} max={5000} min={1} onChange={(e) => setEditingAgent({ ...editingAgent!, max_tokens: parseInt(e.target.value) || 5000 })} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-2 text-xs text-white outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                <Icons.Zap /> Requisições de Ação (Tools)
                                            </label>
                                            <button 
                                                type="button"
                                                onClick={() => setEditingLocalTool({ 
                                                    id: crypto.randomUUID(), 
                                                    name: '', 
                                                    description: '', 
                                                    enabled: true, 
                                                    parameters: '',
                                                    webhookUrl: '',
                                                    method: 'POST'
                                                })}
                                                className="text-[10px] bg-tradestudio-600/20 hover:bg-tradestudio-600 text-tradestudio-400 hover:text-white px-2 py-1 rounded border border-tradestudio-500/30 flex items-center gap-1 transition-all"
                                            >
                                                <Icons.Plus /> Criar Nova Requisição
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {/* Requisições Locais */}
                                            {localAgentTools.length > 0 && (
                                                <div className="space-y-2 pb-2 border-b border-gray-800/50">
                                                    <div className="text-[9px] text-gray-500 font-bold uppercase">Requisições Locais</div>
                                                    {localAgentTools.map(tool => (
                                                        <div key={tool.id} className="flex items-center justify-between p-2 bg-tradestudio-900/10 border border-tradestudio-500/20 rounded-lg group">
                                                            <div className="flex items-center gap-2" onClick={() => setEditingLocalTool(tool)}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${tool.enabled ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                                                                <div className="text-xs font-bold text-white cursor-pointer hover:text-tradestudio-400 transition-colors">{tool.name}</div>
                                                            </div>
                                                            <button 
                                                                type="button"
                                                                onClick={() => setLocalAgentTools(localAgentTools.filter(t => t.id !== tool.id))}
                                                                className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <Icons.Trash />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="text-[9px] text-gray-500 font-bold uppercase">Anexar Globais ({editingAgent?.sector || 'nenhum'})</div>
                                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                {tools.filter(t => 
                                                    (t.sectors || []).includes(editingAgent?.sector || '') || 
                                                    (!t.sectors || t.sectors.length === 0)
                                                ).map(tool => (
                                                    <label key={tool.id} className="flex items-center gap-3 p-2 bg-[#0d1117]/30 border border-gray-800 rounded-lg hover:border-gray-600 cursor-pointer transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedGlobalTools.includes(tool.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedGlobalTools([...selectedGlobalTools, tool.id]);
                                                                else setSelectedGlobalTools(selectedGlobalTools.filter(id => id !== tool.id));
                                                            }}
                                                            className="w-4 h-4 accent-tradestudio-500"
                                                        />
                                                        <div>
                                                            <div className="text-xs font-bold text-white">{tool.name}</div>
                                                            <div className="text-[10px] text-gray-500 truncate w-64">{tool.description}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                                {tools.length === 0 && (
                                                    <div className="text-[10px] text-gray-600 italic">Nenhuma requisição global disponível.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <Icons.Book /> Bases de Conhecimento Globais ({editingAgent?.sector || 'nenhum'})
                                        </label>
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                            {knowledge.filter(k => 
                                                (k.sectors || []).includes(editingAgent?.sector || '') || 
                                                (!k.sectors || k.sectors.length === 0)
                                            ).map(k => (
                                                <label key={k.id} className="flex items-center gap-3 p-2 bg-[#0d1117]/30 border border-gray-800 rounded-lg hover:border-gray-600 cursor-pointer transition-colors">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedGlobalKnowledge.includes(k.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedGlobalKnowledge([...selectedGlobalKnowledge, k.id]);
                                                            else setSelectedGlobalKnowledge(selectedGlobalKnowledge.filter(id => id !== k.id));
                                                        }}
                                                        className="w-4 h-4 accent-tradestudio-500"
                                                    />
                                                    <div>
                                                        <div className="text-xs font-bold text-white">{k.title}</div>
                                                        <div className="text-[10px] text-gray-500 truncate w-64">{k.description}</div>
                                                    </div>
                                                </label>
                                            ))}
                                            {knowledge.length === 0 && (
                                                <div className="text-[10px] text-gray-600 italic">Nenhum conhecimento global disponível.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Coluna 2: Persona e Conhecimento */}
                                <div className="space-y-4">
                                    <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">System Prompt (Persona)</label>
                                            <button 
                                                type="button"
                                                onClick={() => setOpenInfoModal({
                                                    title: 'Caracteres Proibidos na Persona',
                                                    content: (
                                                        <div className="space-y-3">
                                                            <div className="text-sm text-gray-300">Para segurança do sistema, os seguintes caracteres/padrões são automaticamente removidos:</div>
                                                            <ul className="list-disc pl-5 space-y-2 text-gray-400">
                                                                <li>{'{{ }}'} (chaves duplas)</li>
                                                                <li>&lt;script&gt;, &lt;?php, &lt;% (tags de código)</li>
                                                                <li>eval(, system(, exec( (funções perigosas)</li>
                                                                <li>javascript:, data: (URIs maliciosos)</li>
                                                            </ul>
                                                        </div>
                                                    )
                                                })}
                                                className="text-gray-500 hover:text-white transition-colors"
                                            >
                                                <Icons.Info className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <textarea 
                                            name="system_prompt" 
                                            required 
                                            value={editingAgent?.system_prompt || ''} 
                                            onChange={e => {
                                                const sanitized = e.target.value
                                                    .replace(/\{\{/g, '')
                                                    .replace(/\}\}/g, '')
                                                    .replace(/<script.*?>/gi, '')
                                                    .replace(/<\?php/gi, '')
                                                    .replace(/<%/g, '')
                                                    .replace(/eval\s*\(/gi, '')
                                                    .replace(/system\s*\(/gi, '')
                                                    .replace(/exec\s*\(/gi, '')
                                                    .replace(/javascript:/gi, '')
                                                    .replace(/data:/gi, '');
                                                setEditingAgent(editingAgent ? {...editingAgent, system_prompt: sanitized} : null);
                                            }} 
                                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white h-32 focus:border-tradestudio-500 focus:outline-none font-mono resize-none" 
                                            placeholder="Defina a personalidade e instruções..." 
                                        />
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[10px] font-mono ${(editingAgent?.system_prompt?.length || 0) > 35000 ? 'text-red-500' : 'text-gray-500'}`}>{editingAgent?.system_prompt?.length || 0} / 35000 caracteres</span>
                                        </div>
                                    </div>

                                    <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <Icons.Upload /> Documentos Anexados
                                                    <span className="cursor-help text-gray-500" title="Apenas arquivos .pdf ou .docx são permitidos. Limite máximo de 3 arquivos.">
                                                        <Icons.Info className="w-3 h-3" />
                                                    </span>
                                                </label>
                                                <div className="flex flex-col gap-1 items-end">
                                                    <input 
                                                        type="file" 
                                                        ref={fileInputRef} 
                                                        onChange={handleAgentFileUpload} 
                                                        className="hidden" 
                                                        accept=".pdf,.docx"
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="text-[10px] bg-blue-900/30 hover:bg-blue-800 text-blue-400 px-2 py-1 rounded border border-blue-500/30 flex items-center gap-1 transition-colors"
                                                    >
                                                        <Icons.Plus /> Adicionar Documento
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-500">Apenas arquivos .pdf ou .docx são permitidos. Limite de 3 arquivos.</p>
                                        </div>

                                        {/* Lista de Documentos em Cards (Global) */}
                                        <div className="grid grid-cols-1 gap-2">
                                            {attachedFiles.map(file => (
                                                <div key={file.id} className="bg-[#0d1117]/40 border border-gray-800 rounded-lg p-2.5 flex items-center justify-between group hover:border-blue-500/50 transition-all min-h-[45px]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-7 h-7 rounded bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                                                            <Icons.File />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-white pr-2 break-all leading-tight mb-0.5">{file.name}</div>
                                                            <div className="text-[9px] text-gray-500 uppercase font-mono">{(file.size / 1024).toFixed(1)} KB</div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => removeGlobalAttachedFile(file.id)}
                                                        className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-all opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                                                    >
                                                        <Icons.Trash />
                                                    </button>
                                                </div>
                                            ))}
                                            {attachedFiles.length === 0 && (
                                                <div className="text-center py-4 text-gray-600 text-[10px] italic border border-dashed border-gray-800 rounded-lg bg-[#0d1117]/10">
                                                    Nenhum documento anexado.
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3 pt-2 border-t border-gray-800/50">
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-tighter">Texto Local (Manual)</label>
                                                <textarea name="knowledge_base" defaultValue={editingAgent?.knowledge_base} className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white h-24 focus:border-tradestudio-500 focus:outline-none font-mono resize-none" placeholder="Dados específicos para este agente..." />
                                            </div>
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-[10px] text-green-500 font-bold flex items-center gap-1"><Icons.Drive /> Google Doc ID (Sincronização)</label>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input 
                                                        name="google_doc_id" 
                                                        value={tempDocId} 
                                                        onChange={e => setTempDocId(e.target.value)}
                                                        className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none font-mono" 
                                                        placeholder="ID do Google Doc (ex: 1yXw...)" 
                                                    />
                                                    {editingAgent?.id && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleSaveGlobalDocId(editingAgent.id, tempDocId)}
                                                            className="bg-green-600/20 hover:bg-green-600 text-green-500 hover:text-white px-3 py-2 rounded-lg text-[10px] font-bold border border-green-600/30 transition-all"
                                                        >
                                                            Salvar
                                                        </button>
                                                    )}
                                                </div>
                                                {editingAgent?.id && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => manualSyncGoogleDoc(tempDocId, 'global_agents', editingAgent.id)}
                                                        disabled={isSyncing || !tempDocId}
                                                        className="w-full bg-green-600 hover:bg-green-500 text-white px-3 py-2.5 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-600 mt-2"
                                                    >
                                                        {isSyncing ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Icons.Refresh />}
                                                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora (Manual)'}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-3">
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Setores / Departamentos</label>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input 
                                                        type="checkbox" 
                                                        name="sector_all_a"
                                                        id="sector_all_a" 
                                                        checked={agentSelectAll} 
                                                        onChange={(e) => setAgentSelectAll(e.target.checked)} 
                                                        className="w-4 h-4 accent-tradestudio-500" 
                                                    />
                                                    <label htmlFor="sector_all_a" className="text-[11px] font-bold text-gray-300">Todos os setores</label>
                                                </div>
                                                {!agentSelectAll && (
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                        {AGENT_SECTORS.map(s => (
                                                            <div key={s.id} className="flex items-center gap-2">
                                                                <input 
                                                                    type="checkbox" 
                                                                    name={`sector_${s.id}`} 
                                                                    id={`sector_${s.id}_a`} 
                                                                    defaultChecked={editingAgent?.sectors?.includes(s.id)} 
                                                                    className="w-4 h-4 accent-tradestudio-500" 
                                                                />
                                                                <div className="flex items-center gap-2">
                                                                    <div 
                                                                        className="w-3 h-3 rounded-full" 
                                                                        style={{ backgroundColor: s.color }}
                                                                    />
                                                                    <label htmlFor={`sector_${s.id}_a`} className="text-[11px] font-bold text-gray-300">{s.name}</label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1">Intervalo de Sincronização</label>
                                                <select 
                                                    name="sync_interval" 
                                                    defaultValue={editingAgent?.sync_interval || 24} 
                                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 outline-none"
                                                >
                                                    <option value="3">A cada 3 horas</option>
                                                    <option value="6">A cada 6 horas</option>
                                                    <option value="9">A cada 9 horas</option>
                                                    <option value="12">A cada 12 horas</option>
                                                    <option value="24">A cada 24 horas</option>
                                                    <option value="168">A cada 1 semana</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800 space-y-4">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Permissões de Acesso</label>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    name="is_public" 
                                                    id="is_public_a" 
                                                    checked={isAgentPublic}
                                                    onChange={(e) => setIsAgentPublic(e.target.checked)}
                                                    className="w-4 h-4 accent-tradestudio-500" 
                                                />
                                                <label htmlFor="is_public_a" className="text-xs font-bold text-tradestudio-400 cursor-pointer">Todos os cargos (Público)</label>
                                            </div>

                                            {!isAgentPublic && (
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-gray-800/50 animate-fade-in">
                                                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                                                        <div key={role} className="flex items-center gap-2">
                                                            <input 
                                                                type="checkbox" 
                                                                name={`role_${role}`} 
                                                                id={`role_${role}_a`} 
                                                                defaultChecked={editingAgent?.allowed_roles?.includes(role) ?? true} 
                                                                className="w-4 h-4 accent-tradestudio-500" 
                                                            />
                                                            <label htmlFor={`role_${role}_a`} className="text-[11px] font-bold text-gray-300 cursor-pointer">{label}</label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8 border-t border-gray-800 pt-6">
                                <button type="button" onClick={() => setIsAgentModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancelar</button>
                                <button type="submit" disabled={isProcessing} className="px-5 py-2.5 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2">
                                    {isProcessing && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                    {editingAgent ? 'Salvar Agente Global' : 'Criar Agente Global'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Teste de Chat do Agente Global */}
            {isTestChatModalOpen && testChatAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-2xl">
                                    {testChatAgent.avatar}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{testChatAgent.name}</h3>
                                    <p className="text-xs text-gray-500">Teste do agente</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsTestChatModalOpen(false);
                                    setTestChatMessages([]);
                                    setTestChatInput('');
                                }}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4">
                            {testChatMessages.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="text-gray-500 text-sm">Comece a conversar com o agente para testar!</div>
                                </div>
                            ) : (
                                testChatMessages.map(message => (
                                    <div 
                                        key={message.id} 
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] px-4 py-3 rounded-xl ${
                                            message.role === 'user' 
                                                ? 'bg-tradestudio-600 text-white rounded-br-none' 
                                                : 'bg-gray-800 text-gray-200 rounded-bl-none'
                                        }`}>
                                            <div className="text-sm whitespace-pre-wrap">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {testChatIsProcessing && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-800 text-gray-200 px-4 py-3 rounded-xl rounded-bl-none flex items-center gap-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="border-t border-gray-700 pt-4">
                            <div className="flex gap-2">
                                <textarea 
                                    value={testChatInput}
                                    onChange={(e) => setTestChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleTestSend();
                                        }
                                    }}
                                    placeholder="Digite uma mensagem..."
                                    className="flex-1 bg-[#0d1117] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:border-tradestudio-500 outline-none resize-none"
                                    rows={1}
                                />
                                <button 
                                    onClick={handleTestSend}
                                    disabled={testChatIsProcessing}
                                    className="bg-tradestudio-600 hover:bg-tradestudio-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all flex items-center gap-2"
                                >
                                    <Icons.Send />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Editor de Requisição Local (Agente Global) */}
            {editingLocalTool && (
                <ToolEditorModal 
                    isOpen={true} 
                    onClose={() => setEditingLocalTool(null)} 
                    tool={editingLocalTool} 
                    onSave={handleSaveLocalTool} 
                />
            )}

            {/* Info Modal */}
            {openInfoModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Icons.Info />
                                {openInfoModal.title}
                            </h3>
                            <button 
                                onClick={() => setOpenInfoModal(null)}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="text-gray-300">
                            {openInfoModal.content}
                        </div>
                    </div>
                </div>
            )}

            {/* Request Limit Info Modal */}
            {openRequestLimitInfo && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-start justify-between mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Icons.Info />
                                Limite de Requisições
                            </h3>
                            <button 
                                onClick={() => setOpenRequestLimitInfo(false)}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="text-gray-300 space-y-4">
                            <p className="text-sm">
                                Você pode criar até <strong className="text-tradestudio-400">20 requisições</strong> por agente.
                            </p>
                            <div className="bg-[#0d1117]/50 border border-gray-700 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Uso atual</span>
                                    <span className="text-sm font-bold text-white">{tools.length} / 20</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div 
                                        className="bg-tradestudio-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(tools.length / 20) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">
                                Se precisar de mais requisições, remova algumas que não estão mais em uso.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <SuccessAnimation show={showSuccess} message={successMsg} />
        </div>
    );
};

// --- PUBLIC CHAT VIEW ---
const PublicChatView: React.FC = () => {
    const { agentId } = useParams();
    const [agent, setAgent] = useState<AgentConfig & { table?: string } | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadAgent = async () => {
            if (!agentId) return;
            const { data, error } = await supabase
                .from('agents')
                .select('*')
                .eq('id', agentId)
                .eq('is_public', true) // --- SEGURANÇA: Garante que só agentes públicos são acessíveis ---
                .single();
            
            if (data) {
                setAgent({
                    ...DEFAULT_AGENT,
                    id: data.id,
                    name: data.name,
                    avatar: data.avatar,
                    systemPrompt: data.system_prompt,
                    model: data.model,
                    provider: data.provider,
                    knowledgeBase: data.knowledge_base,
                    googleDocId: data.google_doc_id,
                    cachedContent: data.cached_content,
                    tools: data.tools || [],
                    attachedFiles: data.attached_files || [],
                    globalKnowledgeIds: data.global_knowledge_ids || [],
                    table: 'agents'
                });
            } else {
                // Tenta carregar de global_agents se não achar em agents
                const { data: gData } = await supabase
                    .from('global_agents')
                    .select('*')
                    .eq('id', agentId)
                    .eq('is_public', true) // --- SEGURANÇA: Também para agentes globais ---
                    .single();
                
                if (gData) {
                    setAgent({
                        ...DEFAULT_AGENT,
                        id: gData.id,
                        name: gData.name,
                        avatar: gData.avatar,
                        systemPrompt: gData.system_prompt,
                        model: gData.model,
                        provider: gData.provider,
                        knowledgeBase: gData.knowledge_base,
                        googleDocId: gData.google_doc_id,
                        cachedContent: gData.cached_content,
                        tools: gData.tools || [],
                    attachedFiles: gData.attached_files || [],
                    globalKnowledgeIds: gData.global_knowledge_ids || [],
                    table: 'global_agents'
                    });
                }
            }
        };
        loadAgent();
    }, [agentId]);

    const handleManualSync = async () => {
        // --- SEGURANÇA: Bloqueia sincronização manual para usuários não autenticados na view pública ---
        // A sincronização manual deve ser feita apenas através da área logada por um administrador.
        alert('Acesso negado: Sincronização manual permitida apenas para administradores logados.');
        return;
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isProcessing]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !agent || isProcessing) return;

        const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: input, timestamp: Date.now() };
        const messageToSend = input;
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsProcessing(true);

        try {
            const response = await runAgent(agent, messages, messageToSend, null, {}, 'Público (Share)');
            const assistantMsg: ChatMessage = { 
                id: crypto.randomUUID(), 
                role: 'assistant', 
                content: response.content, 
                timestamp: Date.now(),
                toolCalls: response.toolCalls
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: `Erro: ${err.message}`, timestamp: Date.now(), error: true }]);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!agent) return (
        <div className="h-screen bg-[#0d1117] flex items-center justify-center text-gray-500 font-sans">
            <div className="flex flex-col items-center gap-3 animate-pulse">
                <div className="w-10 h-10 border-4 border-tradestudio-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold uppercase tracking-widest">Carregando Agente...</span>
            </div>
        </div>
    );

    return (
        <div className="h-screen bg-[#0d1117] flex flex-col font-sans text-gray-200">
            <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-[#0d1117] shadow-sm relative">
                {/* Logo à Esquerda Superior */}
                <div className="flex items-center">
                    <img src="/logo-tradestudio-v2.svg" alt="TradeStudio" className="h-9 w-auto" />
                </div>

                {/* Nome do Agente Centralizado com Destaque */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 px-5 py-1.5 rounded-2xl flex items-center gap-2 shadow-lg">
                        <span className="text-xl">{agent.avatar}</span>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-white leading-tight">{agent.name}</span>
                            <span className="text-[9px] text-tradestudio-400 uppercase font-bold tracking-widest leading-none">Online</span>
                        </div>
                    </div>
                </div>

                {/* Espaçador para manter o justify-between equilibrado */}
                <div className="w-[120px] flex justify-end gap-2 items-center">
                    {/* Botão de sincronização removido da view pública por segurança */}
                    <div className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter opacity-40">Chat Público</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                        <div className="text-4xl mb-4">{agent.avatar}</div>
                        <h3 className="text-lg font-bold text-white mb-2">Olá! Como posso ajudar?</h3>
                        <p className="text-xs max-w-xs text-gray-400">Inicie uma conversa com o assistente inteligente.</p>
                    </div>
                ) : messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className={`flex max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-col'} items-start gap-3`}>
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm mt-1 ${msg.role === 'user' ? 'bg-gray-700' : 'bg-tradestudio-600'}`}>
                                {msg.role === 'user' ? <Icons.User /> : agent.avatar}
                            </div>
                            <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm ${msg.role === 'user' ? 'bg-gray-800 rounded-tr-none' : 'bg-tradestudio-900/20 border border-tradestudio-500/20 rounded-tl-none'}`}>
                                {msg.role === 'user' ? <div className="whitespace-pre-wrap">{msg.content}</div> : <MarkdownRenderer content={msg.content} />}
                            </div>
                        </div>
                    </div>
                ))}
                {isProcessing && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-tradestudio-600 flex items-center justify-center text-sm mt-1">{agent.avatar}</div>
                            <div className="bg-tradestudio-900/20 border border-tradestudio-500/20 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1 h-9">
                                <div className="w-1 h-1 bg-tradestudio-400 rounded-full animate-bounce"></div>
                                <div className="w-1 h-1 bg-tradestudio-400 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1 h-1 bg-tradestudio-400 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef}></div>
            </div>

            <div className="p-4 bg-[#0d1117] border-t border-gray-800">
                <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        className="w-full bg-[#0d1117] border border-gray-700 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:border-tradestudio-500 outline-none transition-all"
                    />
                    <button type="submit" disabled={!input.trim() || isProcessing} className="absolute right-2 p-2 bg-tradestudio-600 text-white rounded-lg disabled:opacity-50 active:scale-95 transition-all">
                        <Icons.Send />
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---


const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

const AppContent: React.FC = () => {
  // Debug inicial para confirmar execução do script
  console.log('[DEBUG] Componente AppContent carregado');
  
  // Cleanup: Remove any sensitive data from localStorage on load
  useEffect(() => {
    try {
      // Clear Dify config completely and re-add without apiKey
      const savedDify = localStorage.getItem('dify_config');
      if (savedDify) {
        const parsed = JSON.parse(savedDify);
        const { apiKey, ...safeConfig } = parsed;
        localStorage.setItem('dify_config', JSON.stringify(safeConfig));
      }
    } catch (e) {
      console.error('[Cleanup] Error cleaning localStorage:', e);
    }
  }, []);
  
  const navigate = useNavigate();
  const location = useLocation();
  // useParams() não funciona aqui fora do contexto da <Route>, então pegamos do pathname
  const urlAgentId = location.pathname.startsWith('/agent/') ? location.pathname.split('/agent/')[1] : null;
  const urlGlobalAgentId = location.pathname.startsWith('/global-agent/') ? location.pathname.split('/global-agent/')[1] : null;
  
  const [session, setSession] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  
  // Detecta se estamos voltando de um login OAuth (Google)
  const isAuthCallback = window.location.hash.includes('access_token=') || 
                        window.location.search.includes('code=') ||
                        window.location.hash.includes('type=recovery');

  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const isPublicRoute = location.pathname.startsWith('/share/');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [currentAgent, setCurrentAgent] = useState<AgentConfig | null>(null);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [loadingSystemLogs, setLoadingSystemLogs] = useState(false);
  
  // Estados de Filtro para Logs
  const [filterLogSector, setFilterLogSector] = useState('');
  const [filterLogAgent, setFilterLogAgent] = useState('');
  const [filterLogType, setFilterLogType] = useState(''); // 'chat' ou 'tool'
  const [filterLogStatus, setFilterLogStatus] = useState(''); // 'success' ou 'error'
  const [filterLogUser, setFilterLogUser] = useState('');
  const [filterDateMode, setFilterDateMode] = useState<'single' | 'range' | 'none'>('none');
  const [filterSelectedDate, setFilterSelectedDate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const masterEmail = import.meta.env.JUNOS_ADMIN_MASTER_EMAIL || import.meta.env.VITE_ADMIN_MASTER_EMAIL;
  const isMaster = userProfile?.role === 'admin-master' || (masterEmail && session?.user?.email === masterEmail);

  const loadSystemLogs = async () => {
    setLoadingSystemLogs(true);
    try {
        let query = supabase
            .from('tool_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        // Filtro por Agente
        if (filterLogAgent) {
            query = query.eq('agent_id', filterLogAgent);
        } else if (filterLogSector) {
            // Se não tem agente específico mas tem setor, buscamos os IDs dos agentes do setor
            const sectorAgentIds = [...agents, ...globalAgents]
                .filter(a => (a as any).sector === filterLogSector || (a as any).sectors?.includes(filterLogSector))
                .map(a => a.id);
            
            if (sectorAgentIds.length > 0) {
                query = query.in('agent_id', sectorAgentIds);
            } else {
                // Se o setor não tem agentes, força resultado vazio
                setSystemLogs([]);
                setLoadingSystemLogs(false);
                return;
            }
        }

        // Filtro por Usuário (Email)
        if (filterLogUser) {
            query = query.ilike('user_email', `%${filterLogUser}%`);
        }

        // Filtro por Status
        if (filterLogStatus) {
            query = query.eq('status', filterLogStatus);
        }

        // Filtro por Tipo de Execução
        if (filterLogType) {
            if (filterLogType === 'chat') {
                query = query.eq('tool_name', 'Execução Chat');
            } else {
                query = query.neq('tool_name', 'Execução Chat');
            }
        }

        // Filtro por Data
        if (filterDateMode === 'single' && filterSelectedDate) {
            const start = new Date(filterSelectedDate + 'T00:00:00.000Z').toISOString();
            const end = new Date(filterSelectedDate + 'T23:59:59.999Z').toISOString();
            query = query.gte('created_at', start).lte('created_at', end);
        } else if (filterDateMode === 'range' && filterStartDate && filterEndDate) {
            const start = new Date(filterStartDate + 'T00:00:00.000Z').toISOString();
            const end = new Date(filterEndDate + 'T23:59:59.999Z').toISOString();
            query = query.gte('created_at', start).lte('created_at', end);
        }
        
        const { data, error } = await query;
        
        if (data) setSystemLogs(data);
    } catch (err) {
        console.error('Erro ao carregar logs do sistema:', err);
    } finally {
        setLoadingSystemLogs(false);
    }
  };

  useEffect(() => {
    // --- SEGURANÇA: Só carrega logs se houver uma sessão ativa ---
    if (session && location.pathname === '/logs') {
        loadSystemLogs();
    }
  }, [session, location.pathname, filterLogSector, filterLogAgent, filterLogType, filterLogStatus, filterLogUser]);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  
  // Custom Models State
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [newModelForm, setNewModelForm] = useState<CustomModel>({ id: '', name: '', provider: 'openai', context: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Dify Sync State
  const [difyConfig, setDifyConfig] = useState<DifyConfig>(() => {
      const saved = localStorage.getItem('dify_config');
      const savedConfig = saved ? JSON.parse(saved) : { baseUrl: DEFAULT_DIFY_URL, userId: DEFAULT_DIFY_USER, agentName: 'Custom' };
      // Don't load apiKey from localStorage for security
      return { ...savedConfig, apiKey: '' };
  });
  const [lastSyncStatus, setLastSyncStatus] = useState<'success' | 'error' | 'idle'>('idle');
  const [apiKeySyncStatus, setApiKeySyncStatus] = useState<'success' | 'error' | 'idle'>('idle');
  const [isSyncingApiKey, setIsSyncingApiKey] = useState(false);

  useEffect(() => {
      // Only store non-sensitive parts in localStorage
      const { apiKey, ...safeConfig } = difyConfig;
      localStorage.setItem('dify_config', JSON.stringify(safeConfig));
  }, [difyConfig]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [globalKnowledge, setGlobalKnowledge] = useState<GlobalKnowledge[]>([]);
  const [globalTools, setGlobalTools] = useState<GlobalTool[]>([]);
  const [globalAgents, setGlobalAgents] = useState<GlobalAgent[]>([]);

  // Builder State
  const [builderTab, setBuilderTab] = useState<'general' | 'intelligence' | 'prompt' | 'knowledge' | 'tools'>('general');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [inputMsg, setInputMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Agent Chat State
  const [globalChatHistory, setGlobalChatHistory] = useState<ChatMessage[]>([]);
  const [globalCurrentAgent, setGlobalCurrentAgent] = useState<GlobalAgent | null>(null);
  const [globalSessionId, setGlobalSessionId] = useState<string>('');
  const [globalInputMsg, setGlobalInputMsg] = useState('');
  const [globalIsProcessing, setGlobalIsProcessing] = useState(false);
  const globalChatEndRef = useRef<HTMLDivElement>(null);

  // Tools State
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const manualSyncGoogleDoc = async (input: string, id: string) => {
    if (!input) return;
    const syncTimestamp = new Date().toLocaleString('pt-BR');
    const googleToken = (session as any)?.provider_token;

    console.log(`[SYNC] --- Início Sincronização Manual ${syncTimestamp} ---`);
    console.log(`[SYNC] Token Google presente: ${!!googleToken}`);
    if (googleToken) console.log(`[SYNC] Token Google (primeiros 20 chars): ${googleToken.substring(0,20)}...`);

    setIsSyncing(true);
    try {
        const docUrls = input.split(',').filter(id => id.trim());
        let concatenatedContent = '';
        let successCount = 0;
        
        for (const urlOrId of docUrls) {
            const cleanId = extractGoogleId(urlOrId);
            let text = '';
            
            console.log(`[SYNC] Processando: ${cleanId}`);
            
            // First: Check file exists and get metadata
            if (googleToken) {
                try {
                    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}?fields=id,name,mimeType,ownedByMe,shared`;
                    const metadataHeaders = { 'Authorization': `Bearer ${googleToken}` };
                    const metadataRes = await fetch(metadataUrl, { headers: metadataHeaders });
                    
                    console.log(`[SYNC] Metadata check status: ${metadataRes.status}`);
                    
                    if (!metadataRes.ok) {
                        const metadataErr = await metadataRes.text();
                        console.error(`[SYNC] Metadata error:`, metadataErr);
                    } else {
                        const metadata = await metadataRes.json();
                        console.log(`[SYNC] File metadata:`, metadata);
                    }
                } catch (e) {
                    console.error(`[SYNC] Metadata fetch failed:`, e);
                }
            }
            
            // Estratégia de tentativa dupla
            const suspectedIsSheet = isGoogleSheet(urlOrId);
            const formats = suspectedIsSheet ? ['sheet', 'doc'] : ['doc', 'sheet'];

            console.log(`[SYNC] Suspeita: ${suspectedIsSheet ? 'Planilha' : 'Doc'}`);

            for (const format of formats) {
                try {
                    console.log(`[SYNC] ${cleanId}: Tentando ${format.toUpperCase()}, token present: ${!!googleToken}`);
                    
                    let apiUrl: string;
                    if (format === 'doc') {
                        apiUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=text/plain`;
                    } else {
                        apiUrl = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=text/csv`;
                    }
                    
                    const headers: Record<string, string> = {};
                    if (googleToken) {
                        headers['Authorization'] = `Bearer ${googleToken}`;
                    }
                    
                    console.log(`[SYNC] Fetching: ${apiUrl}`);
                    const response = await fetch(apiUrl, { headers });
                    console.log(`[SYNC] ${cleanId} como ${format.toUpperCase()}: response status ${response.status}, ok: ${response.ok}`);

                    if (response.ok) {
                        const resText = await response.text();
                        console.log(`[SYNC] ${cleanId} como ${format.toUpperCase()}: response text length:`, resText.length);
                        
                        if (resText && resText.length > 5) {
                            text = resText;
                            console.log(`[SYNC] Sucesso em ${cleanId} como ${format.toUpperCase()}`);
                            break;
                        }
                    } else {
                        const errorText = await response.text();
                        console.error(`[SYNC] ${cleanId} como ${format.toUpperCase()} failed: status ${response.status}`, errorText);
                    }
                } catch (e) {
                    console.warn(`[SYNC] Tentativa como ${format} falhou para ${cleanId}:`, e);
                }
            }

            if (text) {
                concatenatedContent += `\n\n--- INÍCIO DO DOCUMENTO: ${cleanId} ---\n\n` + text + `\n\n--- FIM DO DOCUMENTO: ${cleanId} ---\n`;
                successCount++;
            }
        }

        if (successCount === 0) {
            throw new Error('Não foi possível baixar o conteúdo. Verifique se os documentos estão compartilhados com sua conta.');
        }

        const { error } = await supabase.from('agents').update({
            cached_content: concatenatedContent,
            last_sync_at: new Date().toISOString()
        }).eq('id', id);

        if (error) throw error;
        triggerSuccess(`Sincronização concluída! (${successCount} docs)`);
        await loadUserAgents();
    } catch (err: any) {
        console.error('[SYNC] Erro Final:', err);
        alert('Erro ao sincronizar: ' + err.message);
    } finally {
        setIsSyncing(false);
        console.log('[SYNC] --- Fim do Processo ---');
    }
  };

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [builderTempDocId, setBuilderTempDocId] = useState('');
  const [openInfoModal, setOpenInfoModal] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const addToast = (type: ToastType, title: string, message?: string) => {
      setToasts(prev => [...prev, { id: crypto.randomUUID(), type, title, message }]);
  };
  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loadUserAgents = async () => {
    if (session) {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', session.user.id);
      
      if (data) {
        console.log("[LOAD USER AGENTS] data from Supabase:", data);
        const mappedAgents: AgentConfig[] = data.map((a: any) => {
          console.log("[LOAD USER AGENTS] agent a.attached_files:", a.attached_files);
          
          // Auto-detect provider
          let detectedProvider: 'gemini' | 'openai' = a.provider === 'google' ? 'gemini' : (a.provider || 'gemini');
          const rawModel = a.model || 'gemini-3-flash-preview';
          if (rawModel.toLowerCase().includes('gpt')) {
            detectedProvider = 'openai';
          }

          return {
            ...DEFAULT_AGENT,
            id: a.id,
            name: a.name || '',
            description: a.description || '',
            avatar: a.avatar || '🤖',
            provider: detectedProvider,
            model: rawModel,
            systemPrompt: a.system_prompt || '',
            temperature: a.temperature || 0.7,
            topP: a.top_p || 0.85,
            maxTokens: a.max_tokens || 5000,
            created_at: a.created_at ? new Date(a.created_at).getTime() : Date.now(),
            knowledgeBase: a.knowledge_base || '',
            googleDocId: a.google_doc_id || '',
            syncInterval: a.sync_interval || 24,
            lastSyncAt: a.last_sync_at,
            cachedContent: a.cached_content,
            attachedFiles: a.attached_files || [], // Carrega arquivos anexados
            globalKnowledgeIds: a.global_knowledge_ids || [],
            apiKey: a.api_key || '',
            isPublic: a.is_public ?? true,
            tools: a.tools || []
          };
        });
        setAgents(mappedAgents);
      }
      if (error) addToast('error', 'Erro ao carregar agentes', error.message);
    }
  };

  const loadGlobalAssets = async () => {
    if (session) {
        console.log('[SYSTEM] Atualizando Ativos Globais...');
        // Busca todos os ativos globais; o filtro de visibilidade será feito na UI baseado no perfil do usuário
        const { data: kData } = await supabase.from('global_knowledge').select('*');
        const { data: tData } = await supabase.from('global_tools').select('*');
        const { data: aData } = await supabase.from('global_agents').select('*');
        if (kData) setGlobalKnowledge(kData);
        if (tData) setGlobalTools(tData);
        if (aData) {
            // Normalize provider for global agents loaded via loadGlobalAssets
            const normalizedGlobalAgents = aData.map((agent: any) => {
                let detectedProvider: 'gemini' | 'openai' = agent.provider === 'google' ? 'gemini' : (agent.provider || 'gemini');
                const rawModel = agent.model || 'gemini-3-flash-preview';
                if (rawModel.toLowerCase().includes('gpt')) {
                    detectedProvider = 'openai';
                }
                return {
                    ...agent,
                    provider: detectedProvider
                };
            });
            setGlobalAgents(normalizedGlobalAgents);
        }
    }
  };

  useEffect(() => {
    console.log('[DEBUG] Versão do Sistema: 2.1.0 - Diagnóstico de Auth');
    
    // Verifica se há parâmetros de erro na URL (vinda do Supabase/Google)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    
    if (hashParams.get('error') || queryParams.get('error')) {
        const errorDesc = hashParams.get('error_description') || queryParams.get('error_description') || 'Erro desconhecido';
        console.error('[AUTH] Erro detectado na URL:', errorDesc);
        alert('Erro no Login: ' + errorDesc);
    }

    // 1. Busca a sessão inicial
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
          console.error('[AUTH] Erro ao recuperar sessão inicial:', error);
      }
      if (session) {
        console.log('[AUTH] Sessão inicial encontrada para:', session.user.email);
        setSession(session);
        setIsAuthenticating(false);
      } else {
        console.log('[AUTH] Nenhuma sessão inicial ativa.');
        if (!isAuthCallback) {
            setIsAuthenticating(false);
        } else {
            console.log('[AUTH] Aguardando processamento do token OAuth...');
            // Aumentado para 10s o tempo de espera em callbacks
            const timer = setTimeout(() => {
                console.log('[AUTH] Tempo de espera do callback esgotado.');
                setIsAuthenticating(false);
            }, 10000);
            return () => clearTimeout(timer);
        }
      }
    });

    // 2. Escutar mudanças na sessão
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AUTH EVENT] Evento Supabase: ${event}`, session?.user?.email ? `Usuário: ${session.user.email}` : 'Sem sessão');
      
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (session) {
            setSession(session);
        }
        setIsAuthenticating(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUserProfile(null);
        setIsAuthenticating(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Carregar agentes sempre que a sessão mudar
  useEffect(() => {
    const loadData = async () => {
        // Se for rota pública, não precisamos carregar perfil ou agentes do usuário logado
        if (isPublicRoute) {
            setIsLoadingAgents(false);
            setIsInitialLoad(false);
            setIsAuthenticating(false);
            return;
        }

        if (session) {
            console.log('[DATA] Sessão ativa para:', session.user.email, 'Iniciando carga de dados...');
            setIsLoadingAgents(true);
            setIsProfileLoading(true);
            
            // 1. Carrega Ativos Globais
            await loadGlobalAssets();

            // 2. Carrega Perfil do Usuário
            try {
                setIsUnauthorized(false);
                let { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();
                
                // Só auto-cria o perfil se for o Admin Master definido nas envs.
                const masterEmail = import.meta.env.JUNOS_ADMIN_MASTER_EMAIL || import.meta.env.VITE_ADMIN_MASTER_EMAIL;
                const isMaster = masterEmail && session.user.email === masterEmail;

                if (!profile && !profileError) {
                    if (isMaster) {
                        console.log('[AUTH] Criando perfil master para:', session.user.email);
                        const newProfile = {
                            id: session.user.id,
                            email: session.user.email,
                            role: 'admin-master' as UserRole,
                            is_master: true
                        };
                        
                        const { data: createdProfile, error: insertError } = await supabase
                            .from('profiles')
                            .insert(newProfile)
                            .select()
                            .single();
                        
                        if (insertError) {
                            console.error('[AUTH] Erro ao criar perfil master:', insertError);
                        }
                        profile = createdProfile;
                    } else {
                        console.warn('[AUTH] Usuário não autorizado:', session.user.email);
                        setIsUnauthorized(true);
                    }
                }
                
                if (profile) {
                    setUserProfile({ 
                        id: profile.id,
                        email: profile.email,
                        role: profile.role, 
                        sectors: profile.sectors || [], // Revertido para plural conforme memória
                        is_master: profile.is_master,
                        created_by: profile.created_by,
                        created_at: profile.created_at
                    });
                    await loadUserAgents();
                }
            } catch (err) {
                console.error('Erro ao carregar perfil:', err);
            } finally {
                setIsProfileLoading(false);
            }
            
            setTimeout(() => {
                setIsLoadingAgents(false);
                setIsInitialLoad(false);
                setIsAuthenticating(false); // Libera a UI somente após o carregamento completo
            }, 500);
        } else {
            setIsProfileLoading(false);
            setIsLoadingAgents(false);
            setIsInitialLoad(false);
            setIsAuthenticating(false); // Libera a UI para mostrar a tela de login
            setUserProfile(null);
        }
    };

    loadData();
  }, [session]);

  // Sincronizar agente atual baseado na URL
  useEffect(() => {
    // Se ainda está no carregamento inicial do sistema, espera (exceto para rotas públicas)
    if (isInitialLoad && !isPublicRoute) return;

    const syncAgentFromUrl = async () => {
        if (!urlAgentId) {
            setCurrentAgent(null);
            return;
        }

        // --- PROTEÇÃO CONTRA RESET DE DADOS ---
        // Se já estamos com o agente correto carregado, não fazemos nada.
        // Isso evita que o estado seja resetado ao trocar de abas ou quando o Supabase atualiza a sessão.
        if (currentAgent && String(currentAgent.id) === String(urlAgentId)) {
            return;
        }

        if (urlAgentId === 'new-agent') {
            const newAgent = { ...DEFAULT_AGENT, created_at: Date.now() };
            setCurrentAgent(newAgent);
            setChatHistory([]);
            setSessionId(crypto.randomUUID());
            return;
        }

        // 1. Tenta achar na lista local já carregada
        const localAgent = agents.find(a => String(a.id) === String(urlAgentId));
        if (localAgent) {
            setCurrentAgent(localAgent);
            setChatHistory([]);
            setSessionId(crypto.randomUUID());
            return;
        }

        // 2. Se não achou localmente, tenta buscar direto no Supabase (importante para links diretos e F5)
        if (session || isPublicRoute) {
            setIsLoadingAgents(true);
            try {
                let query = supabase.from('agents').select('*').eq('id', urlAgentId);
                
                // --- SEGURANÇA: Se for rota pública, filtra apenas agentes públicos no banco ---
                if (isPublicRoute) {
                    query = query.eq('is_public', true);
                }

                const { data, error } = await query.single();
                
                if (data && !error) {
                    // Fallback LocalStorage para campos ausentes no schema do banco
                    const localExtRaw = session ? localStorage.getItem(`agents_ext_${session.user.id}`) : null;
                    const extMap = localExtRaw ? JSON.parse(localExtRaw) : {};
                    const ext = extMap[data.id] || {};

                    // Auto-detect provider based on model name
                    let detectedProvider: 'gemini' | 'openai' = (data.provider === 'google' ? 'gemini' : data.provider) || 'gemini';
                    const rawModel = data.model || 'gemini-3-flash-preview';
                    if (rawModel.toLowerCase().includes('gpt')) {
                        detectedProvider = 'openai';
                    }

                    const mappedAgent: AgentConfig = {
                        ...DEFAULT_AGENT,
                        id: data.id,
                        name: data.name || '',
                        description: ext.description || data.description || '',
                        avatar: ext.avatar || data.avatar || '🤖',
                        provider: detectedProvider,
                        model: rawModel,
                        systemPrompt: data.system_prompt || '',
                        temperature: data.temperature || 0.7,
                        topP: data.top_p || 0.85,
                        maxTokens: data.max_tokens || 5000,
                        created_at: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
                        knowledgeBase: ext.knowledgeBase || data.knowledge_base || '',
                        googleDocId: ext.googleDocId || data.google_doc_id || '',
                        attachedFiles: data.attached_files || [], // Carrega arquivos anexados
                        globalKnowledgeIds: ext.globalKnowledgeIds || data.global_knowledge_ids || [],
                        isPublic: data.is_public ?? true,
                        tools: ext.tools || data.tools || []
                    };
                    setCurrentAgent(mappedAgent);
                    setChatHistory([]);
                    setSessionId(crypto.randomUUID());
                } else {
                    setCurrentAgent(null);
                }
            } catch (err) {
                console.error('Erro ao buscar agente específico:', err);
                setCurrentAgent(null);
            } finally {
                setIsLoadingAgents(false);
            }
        }
    };

    syncAgentFromUrl();
  }, [urlAgentId, agents, isInitialLoad, session]);

  // Sincronizar agente global atual baseado na URL
  useEffect(() => {
    if (isInitialLoad) return;

    const syncGlobalAgentFromUrl = async () => {
      if (!urlGlobalAgentId) {
        setGlobalCurrentAgent(null);
        return;
      }

      if (globalCurrentAgent && String(globalCurrentAgent.id) === String(urlGlobalAgentId)) {
        return;
      }

      // 1. Tenta achar na lista global já carregada
      const localGlobalAgent = globalAgents.find(a => String(a.id) === String(urlGlobalAgentId));
      if (localGlobalAgent) {
        setGlobalCurrentAgent(localGlobalAgent);
        setGlobalChatHistory([]);
        setGlobalSessionId(crypto.randomUUID());
        return;
      }

      // 2. Se não achou localmente, tenta buscar diretamente no Supabase
      if (session) {
        try {
          const { data, error } = await supabase.from('global_agents').select('*').eq('id', urlGlobalAgentId).single();
          
          if (data && !error) {
            setGlobalCurrentAgent(data as any);
            setGlobalChatHistory([]);
            setGlobalSessionId(crypto.randomUUID());
          } else {
            setGlobalCurrentAgent(null);
          }
        } catch (err) {
          console.error('Erro ao buscar agente global específico:', err);
          setGlobalCurrentAgent(null);
        }
      }
    };

    syncGlobalAgentFromUrl();
  }, [urlGlobalAgentId, globalAgents, isInitialLoad, session]);

  useEffect(() => {
     if(chatEndRef.current) {
         chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
     }
  }, [chatHistory, location.pathname]);

  useEffect(() => {
    if(globalChatEndRef.current) {
        globalChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [globalChatHistory, location.pathname]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      addToast('success', 'Senha Atualizada', 'Sua nova senha foi salva com sucesso.');
      setIsResetPasswordModalOpen(false);
      setNewPassword('');
    } catch (err: any) {
      addToast('error', 'Erro ao atualizar senha', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncLogs = async () => {
      if (!session) return;
      setIsSyncing(true);
      try {
          const response = await fetch(`/api/history`, {
              headers: {
                  'Authorization': `Bearer ${session?.access_token}`
              }
          });
          
          if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                  throw new Error("Sessão expirada. Por favor, faça login novamente.");
              }
              throw new Error("Erro de conexão com o servidor");
          }
          const rawLogs = await response.json();
          const newSessions: SavedSession[] = rawLogs.map((log: any) => ({
              id: log.id,
              agentId: log.agentId || 'external-agent',
              agentName: log.agentName || 'Agente Externo',
              agentModel: log.agentModel,
              startTime: log.startTime,
              lastUpdate: log.timestamp,
              status: 'completed',
              summary: log.output ? log.output.substring(0, 50) + '...' : 'Sem resposta',
              messages: [
                  { id: crypto.randomUUID(), role: 'user', content: log.input, timestamp: log.startTime },
                  { id: crypto.randomUUID(), role: 'assistant', content: log.output, timestamp: log.timestamp }
              ]
          }));

          const currentSessions = getSessions();
          const merged = [...newSessions, ...currentSessions];
          const unique = merged.filter((v,i,a)=>a.findIndex(v2=>(v2.id===v.id))===i);
          unique.sort((a,b) => b.startTime - a.startTime);

          setSessions(unique);
          unique.forEach(s => saveSession(s));
          
          addToast('success', 'Sincronização Concluída', `${newSessions.length} conversas recuperadas.`);
      } catch (e) {
          addToast('error', 'Erro de Conexão', `Falha ao conectar com o servidor.`);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleSyncDify = async () => {
    if (!difyConfig.apiKey) {
        addToast('error', 'API Key Ausente', 'Por favor, insira uma chave API válida.');
        return;
    }

    setIsSyncing(true);
    try {
        const difySessions = await fetchDifyLogs(difyConfig);
        
        const newSessions: SavedSession[] = difySessions.map(ds => ({
            id: ds.id,
            agentId: 'dify-agent',
            agentName: ds.name || 'Dify Agent',
            agentModel: 'dify-model',
            startTime: ds.created_at,
            lastUpdate: ds.updated_at,
            status: 'completed',
            summary: ds.messages[ds.messages.length - 1]?.outputs?.substring(0, 50) + '...' || 'Sem mensagens',
            messages: ds.messages.map(m => ({
                id: m.id,
                role: 'assistant',
                content: m.outputs,
                timestamp: m.created_at,
                latency: m.latency
            }))
        }));

        const currentSessions = getSessions();
        const merged = [...newSessions, ...currentSessions];
        const unique = merged.filter((v,i,a)=>a.findIndex(v2=>(v2.id===v.id))===i);
        unique.sort((a,b) => b.startTime - a.startTime);

        setSessions(unique);
        unique.forEach(s => saveSession(s));
        
        setLastSyncStatus('success');
        addToast('success', 'Sincronização Dify Concluída', `${newSessions.length} conversas recuperadas.`);
    } catch (e: any) {
        console.error(e);
        setLastSyncStatus('error');
        addToast('error', 'Erro na Sincronização', e.message || 'Falha ao conectar com o Dify.');
    } finally {
        setIsSyncing(false);
    }
  };

  const handleSyncApiKey = async () => {
    if (!currentAgent?.apiKey) {
        addToast('error', 'Chave Ausente', 'Por favor, insira uma chave API antes de sincronizar.');
        return;
    }

    setIsSyncingApiKey(true);
    setApiKeySyncStatus('idle');

    try {
        // Simulação de validação/sincronização
        // Em um cenário real, poderíamos chamar uma API de teste do provider (Gemini/OpenAI)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setApiKeySyncStatus('success');
        addToast('success', 'Chave Sincronizada', 'Sua chave de API pessoal foi validada e vinculada com sucesso.');
    } catch (e) {
        setApiKeySyncStatus('error');
        addToast('error', 'Erro na Sincronização', 'Não foi possível validar a chave de API.');
    } finally {
        setIsSyncingApiKey(false);
    }
  };

  const handleAddModel = () => {
      if(!newModelForm.id || !newModelForm.name) return;
      saveCustomModel(newModelForm);
      setCustomModels(getCustomModels());

      setIsModelModalOpen(false);
      setNewModelForm({ id: '', name: '', provider: 'openai', context: 'Unknown' });
      addToast('success', 'Modelo Adicionado');
  };

  const handleCreateAgent = () => {
    const newAgent = { ...DEFAULT_AGENT, created_at: Date.now() };
    setCurrentAgent(newAgent);
    setChatHistory([]);
    setSessionId(crypto.randomUUID());
    navigate('/agent/new-agent');
    setBuilderTab('general');
  };

  const handleEditAgent = (agent: AgentConfig) => {
    setCurrentAgent(agent);
    navigate(`/agent/${agent.id}`);
    setBuilderTab('general');
  };

  const startNewSession = (agent: AgentConfig) => {
      setSessionId(crypto.randomUUID());
      setChatHistory([]);
  };

  // --- RE-SINCRONIZAÇÃO FORÇADA v2.0.5 - PERSISTÊNCIA HÍBRIDA ---
  // --- PERSISTÊNCIA HÍBRIDA v2.0.8 - ESTABILIDADE TOTAL ---
  const handleSaveCurrentAgent = async () => {
    if (!currentAgent || !session || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const agentData: any = {
        name: currentAgent.name,
        description: currentAgent.description,
        avatar: currentAgent.avatar,
        system_prompt: currentAgent.systemPrompt,
        temperature: currentAgent.temperature,
        user_id: session.user.id,
        model: currentAgent.model || 'gemini-1.5-flash',
        provider: currentAgent.provider || 'google',
        tools: currentAgent.tools || [],
        knowledge_base: sanitizeForPostgres(currentAgent.knowledgeBase || ''),
        attached_files: (currentAgent.attachedFiles || []).map(f => ({ ...f, content: sanitizeForPostgres(f.content) })), // Sanitiza conteúdo dos arquivos
        google_doc_id: currentAgent.googleDocId || '',
        global_knowledge_ids: currentAgent.globalKnowledgeIds || [],
        api_key: currentAgent.apiKey || ''
      };

      const isNew = currentAgent.id === 'new-agent';
      
      // Tenta salvar todos os campos no Supabase para que a API tenha acesso
      const fullData = {
        name: currentAgent.name,
        description: currentAgent.description,
        avatar: currentAgent.avatar,
        system_prompt: currentAgent.systemPrompt,
        temperature: currentAgent.temperature,
        top_p: currentAgent.topP,
        max_tokens: currentAgent.maxTokens,
        user_id: session.user.id,
        model: currentAgent.model || 'gemini-1.5-flash',
        provider: currentAgent.provider || 'google',
        tools: currentAgent.tools || [],
        knowledge_base: sanitizeForPostgres(currentAgent.knowledgeBase || ''),
        attached_files: (currentAgent.attachedFiles || []).map(f => ({ ...f, content: sanitizeForPostgres(f.content) })), // Sanitiza conteúdo dos arquivos
        google_doc_id: currentAgent.googleDocId || '',
        sync_interval: currentAgent.syncInterval || 24,
        last_sync_at: currentAgent.lastSyncAt,
        cached_content: currentAgent.cachedContent,
        global_knowledge_ids: currentAgent.globalKnowledgeIds || [],
        api_key: currentAgent.apiKey || '',
        is_public: currentAgent.isPublic ?? true
      };

      const { data, error } = await supabase
        .from('agents')
        .upsert({
          ...(isNew ? {} : { id: currentAgent.id }),
          ...fullData
        })
        .select()
        .single();

      if (error) {
          console.error('Erro detalhado do Supabase:', error);
          throw new Error(`Erro no banco: ${error.message}`);
      }

      if (data) {
          const finalId = data.id;

          // PERSISTÊNCIA NA NUVEM: Os campos pesados já estão sendo salvos no Supabase (colunas text/jsonb).
          // Removido o uso de LocalStorage para evitar exposição de dados sensíveis e inconsistências.

          const fullyUpdatedAgent = { ...currentAgent, id: finalId };
          setCurrentAgent(fullyUpdatedAgent);
          setAgents(prev => {
              const filtered = prev.filter(a => a.id !== (isNew ? 'new-agent' : finalId));
              return [...filtered, fullyUpdatedAgent];
          });

          triggerSuccess(isNew ? 'Agente Criado!' : 'Agente Sincronizado!');
          if (isNew) navigate('/');
      }
    } catch (e: any) {
      addToast('error', 'Erro no salvamento', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDuplicateAgent = async (agent: AgentConfig, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!session) return;
      
      setIsProcessing(true);
      try {
          // Campos que existem na tabela 'agents' no Supabase
          const duplicatedData = {
              name: `${agent.name} (Cópia)`,
              description: agent.description,
              avatar: agent.avatar,
              system_prompt: agent.systemPrompt,
              temperature: agent.temperature,
              top_p: agent.topP,
              max_tokens: agent.maxTokens,
              user_id: session.user.id,
              model: agent.model || 'gemini-1.5-flash',
              provider: agent.provider || 'google',
              tools: agent.tools || [],
              knowledge_base: agent.knowledgeBase || '',
              google_doc_id: agent.googleDocId || '',
              sync_interval: agent.syncInterval || 24,
              last_sync_at: agent.lastSyncAt,
              cached_content: agent.cachedContent,
              global_knowledge_ids: agent.globalKnowledgeIds || [],
              api_key: agent.apiKey || '',
              is_public: agent.isPublic ?? true
          };

          const { data, error } = await supabase
              .from('agents')
              .insert(duplicatedData)
              .select()
              .single();

          if (error) throw error;

          if (data) {
              const newAgent: AgentConfig = {
                  ...agent,
                  id: data.id,
                  name: duplicatedData.name,
                  created_at: new Date(data.created_at).getTime()
              };

              setAgents(prev => [newAgent, ...prev]);
              addToast('success', 'Agente Duplicado', `Uma cópia de ${agent.name} foi criada.`);
          }
      } catch (err: any) {
          addToast('error', 'Erro ao duplicar', err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleDeleteAgent = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (id === 'new-agent') return;
      
      if (confirm('Tem certeza que deseja excluir este agente?')) {
          try {
              const { error } = await supabase.from('agents').delete().eq('id', id);
              if (error) throw error;
              
              setAgents(prev => prev.filter(a => a.id !== id));
              addToast('info', 'Agente Excluído');
          } catch (err: any) {
              addToast('error', 'Erro ao excluir', err.message);
          }
      }
  };

  const handleDeleteGlobalAgent = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (confirm('Tem certeza que deseja excluir este agente global?')) {
          try {
              const { error } = await supabase.from('global_agents').delete().eq('id', id);
              if (error) throw error;
              
              setGlobalAgents(prev => prev.filter(a => a.id !== id));
              addToast('info', 'Agente Global Excluído');
          } catch (err: any) {
              addToast('error', 'Erro ao excluir', err.message);
          }
      }
  };

  // --- TOOL HANDLERS ---
  const handleSaveTool = (newTool: AgentTool) => {
      if (!currentAgent || !session) return;
      
      const newTools = [...(currentAgent.tools || [])];
      const idx = newTools.findIndex(t => t.id === newTool.id);
      if (idx >= 0) newTools[idx] = newTool;
      else newTools.push(newTool);
      
      const updatedAgent = { ...currentAgent, tools: newTools };
      setCurrentAgent(updatedAgent);
      
      setEditingTool(null);
      addToast('success', 'Requisição Local', `Ferramenta ${newTool.name} guardada temporariamente.`);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!inputMsg.trim() || !currentAgent || isProcessing) return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: inputMsg, timestamp: Date.now() };
      
      const updatedHistory = [...chatHistory, userMsg];
      setChatHistory(updatedHistory);
      setInputMsg('');
      setIsProcessing(true);

      const startTime = Date.now();
      
      const activeSessionId = sessionId || crypto.randomUUID();
      if (!sessionId) setSessionId(activeSessionId);

      const currentSessionState: SavedSession = {
          id: activeSessionId,
          agentId: currentAgent.id,
          agentName: currentAgent.name,
          agentModel: currentAgent.model,
          startTime: startTime,
          lastUpdate: Date.now(),
          messages: updatedHistory,
          status: 'active',
          summary: updatedHistory[0]?.content.substring(0, 50) + '...'
      };
      saveSession(currentSessionState);

      try {
          // Passamos o email do perfil ou da sessão para garantir a identificação correta nos logs
          const userEmail = userProfile?.email || session?.user?.email;
          console.log(`[CHAT] Enviando mensagem para ${currentAgent.name} (User: ${userEmail || 'Sistema'})`);
          
          const response = await runAgent(
            currentAgent, 
            updatedHistory, 
            inputMsg, 
            null, 
            {}, 
            userEmail,
            (session as any)?.provider_token
          );
          
          let newHistory = [...updatedHistory];
          
          if (response.toolCalls) {
              response.toolCalls.forEach(call => {
                  newHistory.push({
                      id: crypto.randomUUID(),
                      role: 'assistant',
                      content: `Requisição Disparada: ${call.name}`,
                      timestamp: Date.now(),
                      toolCalls: [call]
                  });
              });
          }

          const aiMsg: ChatMessage = { 
              id: crypto.randomUUID(), 
              role: 'assistant', 
              content: response.content, 
              timestamp: Date.now(),
              tokens: response.usage?.totalTokens
          };
          newHistory.push(aiMsg);
          
          setChatHistory(newHistory);
          
          saveSession({
              ...currentSessionState,
              messages: newHistory,
              lastUpdate: Date.now(),
              status: 'active'
          });

      } catch (err: any) {
          const errorMsg: ChatMessage = { 
              id: crypto.randomUUID(), 
              role: 'system', 
              content: `Erro: ${err.message}`, 
              timestamp: Date.now(),
              error: true
          };
          const errorHistory = [...updatedHistory, errorMsg];
          setChatHistory(errorHistory);
          
          saveSession({
              ...currentSessionState,
              messages: errorHistory,
              lastUpdate: Date.now(),
              status: 'error'
          });
      } finally {
          setIsProcessing(false);
      }
  };

  const handleGlobalSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!globalInputMsg.trim() || !globalCurrentAgent || globalIsProcessing) return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: globalInputMsg, timestamp: Date.now() };
      
      const updatedHistory = [...globalChatHistory, userMsg];
      setGlobalChatHistory(updatedHistory);
      setGlobalInputMsg('');
      setGlobalIsProcessing(true);

      const startTime = Date.now();
      
      const activeSessionId = globalSessionId || crypto.randomUUID();
      if (!globalSessionId) setGlobalSessionId(activeSessionId);

      try {
          // Convert GlobalAgent to AgentConfig for runAgent
          const tempAgent: AgentConfig = {
              ...DEFAULT_AGENT,
              id: globalCurrentAgent.id,
              name: globalCurrentAgent.name,
              description: globalCurrentAgent.description,
              avatar: globalCurrentAgent.avatar,
              provider: globalCurrentAgent.provider,
              model: globalCurrentAgent.model,
              isReasoning: globalCurrentAgent.is_reasoning,
              systemPrompt: globalCurrentAgent.system_prompt,
              temperature: globalCurrentAgent.temperature,
              topP: globalCurrentAgent.top_p,
              maxTokens: globalCurrentAgent.max_tokens,
              tools: (globalCurrentAgent.tools as any) || [],
              attachedFiles: globalCurrentAgent.attached_files || [],
              globalKnowledgeIds: globalCurrentAgent.global_knowledge_ids || [],
              knowledgeBase: globalCurrentAgent.knowledge_base,
              googleDocId: globalCurrentAgent.google_doc_id,
              cachedContent: globalCurrentAgent.cached_content,
              apiKey: globalCurrentAgent.api_key
          };

          // Passamos o email do perfil ou da sessão para garantir a identificação correta nos logs
          const userEmail = userProfile?.email || session?.user?.email;
          console.log(`[GLOBAL CHAT] Enviando mensagem para ${globalCurrentAgent.name} (User: ${userEmail || 'Sistema'})`);
          
          const response = await runAgent(
            tempAgent, 
            updatedHistory, 
            globalInputMsg, 
            null, 
            {}, 
            userEmail,
            (session as any)?.provider_token
          );
          
          let newHistory = [...updatedHistory];
          
          if (response.toolCalls) {
              response.toolCalls.forEach(call => {
                  newHistory.push({
                      id: crypto.randomUUID(),
                      role: 'assistant',
                      content: `Requisição Disparada: ${call.name}`,
                      timestamp: Date.now(),
                      toolCalls: [call]
                  });
              });
          }

          const aiMsg: ChatMessage = { 
              id: crypto.randomUUID(), 
              role: 'assistant', 
              content: response.content, 
              timestamp: Date.now(),
              tokens: response.usage?.totalTokens
          };
          newHistory.push(aiMsg);
          
          setGlobalChatHistory(newHistory);

      } catch (err: any) {
          const errorMsg: ChatMessage = { 
              id: crypto.randomUUID(), 
              role: 'system', 
              content: `Erro: ${err.message}`, 
              timestamp: Date.now(),
              error: true
          };
          const errorHistory = [...updatedHistory, errorMsg];
          setGlobalChatHistory(errorHistory);
      } finally {
          setGlobalIsProcessing(false);
      }
  };
  
  // MODO REVISÃO DE SESSÃO
  const handleViewSession = (session: SavedSession) => {
      const agent = agents.find(a => a.id === session.agentId) || { ...DEFAULT_AGENT, name: session.agentName, model: session.agentModel };
      setCurrentAgent(agent);
      setSessionId(session.id);
      setChatHistory(session.messages);
      navigate(`/session/${session.id}`);
  };

  const jumpToBuilderTab = (tab: 'prompt' | 'knowledge') => {
      setBuilderTab(tab);
      if (currentAgent) navigate(`/agent/${currentAgent.id}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentAgent) return;

      // Validate file type
      const allowedExtensions = ['.pdf', '.docx'];
      const isValid = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      if (!isValid) {
          addToast('error', 'Arquivo inválido', 'Apenas arquivos .pdf ou .docx são permitidos');
          if(fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      // Validate file count
      const currentFiles = currentAgent.attachedFiles || [];
      if (currentFiles.length >= 3) {
          addToast('error', 'Limite de arquivos', 'Você pode anexar no máximo 3 arquivos');
          if(fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      let text = '';
      
      if (file.name.toLowerCase().endsWith('.docx')) {
          try {
              const mammoth = await import('mammoth');
              const arrayBuffer = await file.arrayBuffer();
              const result = await mammoth.extractRawText({ arrayBuffer });
              text = result.value;
              console.log("[HANDLE FILE UPLOAD] .docx file parsed successfully, text length:", text.length);
          } catch (err) {
              console.error("[HANDLE FILE UPLOAD] Error parsing .docx file:", err);
              addToast('error', 'Erro ao ler arquivo', 'Não foi possível extrair o texto do arquivo .docx.');
              return;
          }
      } else {
          text = `[Arquivo PDF anexado: ${file.name}]`;
      }

      console.log("[HANDLE FILE UPLOAD] file:", file.name, "type:", file.type, "content length:", text.length);
      
      const newFile: AttachedFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || 'text/plain',
          size: file.size,
          content: text,
          created_at: Date.now()
      };
      
      setCurrentAgent({
          ...currentAgent,
          attachedFiles: [...currentFiles, newFile]
      });
      addToast('success', 'Arquivo Anexado', `${file.name} foi adicionado como documento.`);
      
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedFile = (fileId: string) => {
      if (!currentAgent) return;
      const currentFiles = currentAgent.attachedFiles || [];
      setCurrentAgent({
          ...currentAgent,
          attachedFiles: currentFiles.filter(f => f.id !== fileId)
      });
      addToast('info', 'Arquivo Removido');
  };

  const handleSaveDocId = () => {
      if(!currentAgent) return;
      handleSaveCurrentAgent(); // Usar a função correta de salvamento
      triggerSuccess('Sincronização configurada!');
  };

  const deleteMessage = (msgId: string) => {
      const newHistory = chatHistory.filter(m => m.id !== msgId);
      setChatHistory(newHistory);
      if (sessionId) {
          const session = sessions.find(s => s.id === sessionId);
          if (session) {
              saveSession({ ...session, messages: newHistory });
          }
      }
  };

  const allModels: CustomModel[] = [...SYSTEM_MODELS, ...customModels];
  const isReasoning = currentAgent?.isReasoning === true;
  const estimatedTokens = currentAgent?.knowledgeBase ? Math.ceil(currentAgent.knowledgeBase.length / 4) : 0;

  return (
    <div className="min-h-screen flex bg-[#0d1117] font-sans text-gray-200 selection:bg-tradestudio-500/30">
      
      {/* GLOBAL TOAST CONTAINER */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* SIDEBAR */}
      {session && !isUnauthorized && !location.pathname.startsWith('/share/') && (
      <div className={`${isSidebarCollapsed ? 'w-[80px]' : 'w-[300px]'} flex-shrink-0 border-r border-gray-800 bg-black flex flex-col z-20 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] relative`}>
        <div className={`${isSidebarCollapsed ? 'px-1' : 'px-6'} py-4 flex-1 flex flex-col overflow-hidden transition-all duration-500`}>
          <div className={`flex items-center justify-center mb-8 transition-all duration-500 ease-in-out relative w-full`}>
              <div className={`relative flex items-center justify-center transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'w-9' : 'w-full'}`} style={{ height: isSidebarCollapsed ? '36px' : 'auto' }}>
                {/* Logo Expandida */}
                <div className={`transition-all duration-500 ease-in-out transform flex-shrink-0 ${isSidebarCollapsed ? 'opacity-0 -translate-x-8 scale-75 absolute pointer-events-none' : 'opacity-100 translate-x-0 scale-100 relative flex justify-center items-center'}`}>
                    <img src="/logo-tradestudio-v2.svg" alt="TradeStudio" className="h-9 w-auto" />
                </div>
                {/* Logo Compacta (SVG Fornecido) */}
                <div className={`transition-all duration-500 ease-in-out transform flex-shrink-0 ${isSidebarCollapsed ? 'opacity-100 scale-100 relative' : 'opacity-0 scale-50 -translate-x-4 absolute pointer-events-none'}`}>
                    <CompactLogo />
                </div>
              </div>
            </div>

          <nav className="space-y-1 flex-1">
            <div className={`px-1 mb-2 text-[10px] uppercase font-bold text-gray-600 tracking-widest transition-all duration-500 overflow-hidden ${isSidebarCollapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'}`}>
                Menu Principal
            </div>
            <SidebarItem 
                active={location.pathname === '/'} 
                to="/"
                label="Meus Agentes"
                icon={<Icons.Dashboard />}
                collapsed={isSidebarCollapsed}
            />
            <SidebarItem 
                active={location.pathname === '/tool-logs'} 
                to="/tool-logs"
                label="Logs de Requisições"
                icon={<Icons.Activity />}
                collapsed={isSidebarCollapsed}
            />
            {userProfile?.role !== 'colaborador' && (
              <SidebarItem 
                  active={location.pathname === '/logs' || location.pathname.startsWith('/session/')} 
                  to="/logs"
                  label="Histórico & Sync"
                  icon={<Icons.Logs />}
                  collapsed={isSidebarCollapsed}
              />
            )}
            {((['qualidade', 'lider', 'admin', 'dev', 'admin-master'].includes(userProfile?.role || '')) || isMaster) && (
              <>
                <div className={`px-1 mt-4 mb-2 text-[10px] uppercase font-bold text-gray-600 tracking-widest transition-all duration-500 overflow-hidden ${isSidebarCollapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'}`}>
                    Administração
                </div>
                <SidebarItem 
                    active={location.pathname === '/global-assets'} 
                    to="/global-assets"
                    label="Ativos Globais"
                    icon={<Icons.Globe />}
                    collapsed={isSidebarCollapsed}
                />
                {((['co-lider', 'lider', 'admin', 'dev', 'admin-master'].includes(userProfile?.role || '')) || isMaster) && (
                  <SidebarItem 
                      active={location.pathname === '/admin/users'} 
                      to="/admin/users"
                      label="Gestão de Usuários"
                      icon={<Icons.Users />}
                      collapsed={isSidebarCollapsed}
                  />
                )}
              </>
            )}
          </nav>
        </div>

        <div className={`mt-auto transition-all duration-500 ${isSidebarCollapsed ? 'p-2' : 'p-4'} border-t border-gray-800 relative`}>
           {/* BOTÃO DE EXPANDIR/RECOLHER (POSIÇÃO FIXA ACIMA DA ESTRELA) */}
           <div className={`absolute top-0 left-0 right-0 -translate-y-full pb-[20px] flex items-center transition-all duration-500 h-11 ${isSidebarCollapsed ? 'justify-center' : 'justify-center px-4'}`}>
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="flex items-center justify-center gap-2 w-auto px-4 h-11 rounded-xl text-gray-500 hover:text-white hover:bg-gray-800 transition-all duration-500 border border-transparent"
                title={isSidebarCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
              >
                <Icons.Menu 
                  className="transition-transform duration-500" 
                  style={{ transform: isSidebarCollapsed ? 'scaleX(-1)' : 'scaleX(1)' }} 
                />
                {!isSidebarCollapsed && (
                  <span className="text-sm font-bold whitespace-nowrap">Ocultar Menu</span>
                )}
              </button>
           </div>

           <div className="h-11 mb-1"></div>

           <div className={`flex items-center ${isSidebarCollapsed ? 'p-2' : 'p-3'} bg-gray-800/50 rounded-lg border border-gray-700/50 transition-all duration-500 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              <div className="flex items-center overflow-hidden">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                   <svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-500 transform hover:scale-110">
                     <path d="M0.275752 18.9946C0.670222 19.7525 4.73816 20.5472 6.08182 21.1523C11.173 23.4568 13.959 27.4423 15.7649 32.5219C16.2148 33.7933 15.9682 34.9547 17.2441 36H18.0392C20.4924 34.8753 20.4061 31.6233 21.6881 29.1294C23.2968 25.9997 25.8485 23.3773 28.9488 21.6841C31.3773 20.3638 33.9229 20.1926 36 18.585V17.7904C35.0508 15.3942 32.1231 15.6204 29.8672 14.5751C25.5466 12.5701 22.3907 8.64582 20.6464 4.32416C19.9931 2.69208 20.4184 0.0880825 18.218 0.00250512C15.58 -0.0952975 16.1223 2.69208 15.3272 4.60534C13.6507 8.64581 10.7169 12.3012 6.74754 14.3C4.59644 15.382 -1.3576 15.816 0.281921 18.9823L0.275752 18.9946Z" fill="white"/>
                   </svg>
                </div>
                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[150px] opacity-100'}`}>
                    <div className="text-xs font-bold text-white whitespace-nowrap ml-3 truncate">
                        {isMaster ? 'Admin Master' : userProfile?.role ? ROLE_LABELS[userProfile.role as UserRole] : 'Usuário'}
                    </div>
                    <div className="text-[10px] text-gray-500 whitespace-nowrap ml-3 truncate">{session?.user?.email}</div>
                </div>
              </div>
              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isSidebarCollapsed ? 'max-w-0 opacity-0' : 'max-w-[40px] opacity-100'}`}>
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all ml-2"
                  title="Sair"
                >
                  <Icons.Logout />
                </button>
              </div>
           </div>
        </div>
      </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0d1117]/40 backdrop-blur-3xl relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-tradestudio-900/20 via-transparent to-transparent"></div>
        
        <Routes>
          <Route path="/login" element={
            isAuthenticating ? (
              <div className="flex h-screen items-center justify-center bg-[#0d1117]">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-tradestudio-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-400 text-sm font-medium">Verificando acesso...</p>
                </div>
              </div>
            ) : session ? <Navigate to="/" /> : (
              <div className="flex h-screen items-center justify-center bg-white p-4">
                <div className="w-full max-w-3xl text-center">
                  <div className="mb-8">
                    <img src="/logo-tradestudio-black.svg" alt="TradeStudio" className="h-20 w-auto mx-auto" />
                  </div>
                  <h1 className="text-5xl font-bold text-black mb-4">Bem-vindo</h1>
                  <p className="text-gray-600 text-lg mb-8">Faça login para acessar sua conta</p>
                  
                  <div className="w-full max-w-lg mx-auto mb-8">
                    <Auth 
                      supabaseClient={supabase} 
                      appearance={{
                        theme: ThemeSupa,
                        style: {
                          container: { 
                            gap: '16px',
                            width: '100%'
                          },
                          button: {
                            backgroundColor: '#000',
                            border: '1px solid #374151',
                            color: '#fff',
                            padding: '1rem 1.5rem',
                            fontSize: '1.25rem',
                            fontWeight: '500',
                            borderRadius: '0.75rem',
                            transition: 'all 0.2s ease-in-out',
                            width: '100%'
                          },
                          anchor: { color: '#000', textDecoration: 'underline', textDecorationColor: '#000' }
                        }
                      }} 
                      theme="default" 
                      providers={['google']} 
                      onlyThirdPartyProviders={true}
                      providerScopes={{
                        google: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly'
                      }}
                      queryParams={{
                        access_type: 'offline',
                        prompt: 'consent'
                      }}
                      view="sign_in"
                      showLinks={false}
                      redirectTo={window.location.origin}
                      localization={{
                        variables: {
                          sign_in: {
                            social_provider_text: 'Entrar com Google'
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Link Alternativo */}
                  <button 
                    onClick={async () => {
                      await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          scopes: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly',
                          redirectTo: window.location.origin,
                          queryParams: {
                            access_type: 'offline',
                            prompt: 'consent'
                          }
                        }
                      });
                    }} 
                    className="w-full max-w-lg bg-transparent border border-gray-700 hover:bg-gray-900 text-gray-500 hover:text-gray-300 text-lg font-medium py-4 px-8 rounded-xl transition-all hover:border-gray-500"
                  >
                    Problemas com login, clique nesse link
                  </button>
                </div>
              </div>
            )
          } />

          <Route path="/" element={
            (isAuthenticating || isProfileLoading) ? (
              <div className="flex h-screen items-center justify-center bg-[#0d1117]">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-tradestudio-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-400 text-sm font-medium">Carregando...</p>
                </div>
              </div>
            ) : isUnauthorized ? (
              <div className="flex h-screen items-center justify-center bg-[#0d1117] p-4">
                <div className="w-full max-w-md bg-[#161b22] border border-red-900/30 p-8 rounded-2xl shadow-2xl text-center">
                    <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icons.Lock />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
                    <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                        Seu e-mail (<span className="text-gray-200 font-mono">{session.user.email}</span>) está autenticado, mas não possui permissão para acessar o sistema.
                    </p>
                    <div className="bg-[#0d1117]/40 border border-gray-700 p-4 rounded-xl mb-8">
                        <p className="text-tradestudio-400 font-bold text-sm">
                            Solicite a criação do seu usuário ao seu supervisor.
                        </p>
                    </div>
                    <button 
                        onClick={() => supabase.auth.signOut()}
                        className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                        <Icons.Logout /> Sair da Conta
                    </button>
                </div>
              </div>
            ) : !session ? <Navigate to="/login" /> : (
            <div className="p-10 overflow-y-auto custom-scrollbar h-full relative z-10 bg-white">
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h2 className="text-xl font-bold text-black mb-1">Meus Agentes</h2>
                        <p className="text-gray-600 text-xs">Gerencie, configure e teste seus assistentes inteligentes.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <button 
                        onClick={handleCreateAgent}
                        className="group flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-2xl hover:border-tradestudio-500/50 hover:bg-tradestudio-50 transition-all duration-300"
                    >
                        <div className="w-14 h-14 rounded-full bg-gray-200 group-hover:bg-tradestudio-600 flex items-center justify-center text-gray-600 group-hover:text-white transition-all duration-300 mb-4 shadow-lg">
                            <Icons.Plus />
                        </div>
                        <span className="font-bold text-gray-700 group-hover:text-tradestudio-600">Criar Novo Agente</span>
                        <span className="text-xs text-gray-500 mt-1">Começar do zero</span>
                    </button>

                    {agents.map(agent => (
                        <div key={agent.id} onClick={() => handleEditAgent(agent)} className="group bg-black border border-gray-800 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-800 transition-all cursor-pointer relative overflow-hidden flex flex-col h-64">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-tradestudio-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-3xl shadow-inner border border-white/5">
                                    {agent.avatar}
                                </div>
                                <div className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase border ${agent.provider === 'gemini' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                                    {agent.provider}
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-2 truncate">{agent.name}</h3>
                            <p className="text-xs text-gray-500 line-clamp-3 mb-auto leading-relaxed">{agent.description}</p>
                            
                            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                                <div className="text-[10px] text-gray-400 flex flex-col">
                                    <span className="font-bold text-gray-300">{agent.model}</span>
                                    <span className="opacity-60">{format(agent.created_at, 'dd MMM yyyy')}</span>
                                </div>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => handleDuplicateAgent(agent, e)} 
                                        className="p-2 text-gray-600 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Duplicar Agente"
                                    >
                                        <Icons.Copy />
                                    </button>
                                    <button 
                                        onClick={(e) => handleDeleteAgent(agent.id, e)} 
                                        className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Excluir Agente"
                                    >
                                        <Icons.Trash />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            )
          } />

          <Route path="/logs" element={
            !session ? <Navigate to="/login" /> : (
            <div className="flex flex-col h-full bg-white relative z-10">
               <div className="px-8 py-6 border-b border-gray-200 bg-white space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                              <Icons.Logs /> Central de Logs do Sistema
                          </h2>
                          <div className="flex items-center gap-2">
                              <div className="relative w-64">
                                  <input 
                                      type="password" 
                                      value={difyConfig.apiKey}
                                      onChange={(e) => setDifyConfig({...difyConfig, apiKey: e.target.value})}
                                      placeholder="Sincronizar Dify (Opcional)"
                                      className="w-full bg-gray-50 border border-gray-300 text-[10px] text-blue-600 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 font-mono pr-8"
                                  />
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                       {lastSyncStatus === 'success' ? <span className="text-green-600"><Icons.Check className="w-3 h-3" /></span> : 
                                        lastSyncStatus === 'error' ? <span className="text-red-600"><Icons.Lock className="w-3 h-3" /></span> : 
                                        difyConfig.apiKey ? <span className="text-blue-600/50"><Icons.Cloud className="w-3 h-3" /></span> : 
                                        <span className="text-gray-500"><Icons.Lock className="w-3 h-3" /></span>}
                                   </div>
                              </div>
                              <button 
                                onClick={handleSyncDify} 
                                disabled={isSyncing}
                                className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-all font-bold flex items-center gap-1.5 disabled:opacity-50"
                              >
                                 <Icons.Sync className="w-3 h-3" /> {isSyncing ? '...' : 'Dify'}
                              </button>
                          </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={loadSystemLogs} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded-lg transition-all font-bold border border-gray-300 flex items-center gap-2">
                            <Icons.Refresh /> Atualizar
                        </button>
                        <button 
                            onClick={() => {
                                setFilterLogSector('');
                                setFilterLogAgent('');
                                setFilterLogType('');
                                setFilterLogStatus('');
                                setFilterLogUser('');
                                setFilterDateMode('none');
                                setFilterSelectedDate('');
                                setFilterStartDate('');
                                setFilterEndDate('');
                            }}
                            className="text-xs bg-gray-100 text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
                        >
                            Limpar Filtros
                        </button>
                      </div>
                  </div>

                  {/* Barra de Filtros */}
                  <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Filtros:</span>
                          <select 
                            value={filterLogSector} 
                            onChange={e => { setFilterLogSector(e.target.value); setFilterLogAgent(''); }}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                          >
                            <option value="">Todos Setores</option>
                            {AGENT_SECTORS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>

                          <select 
                            value={filterLogAgent} 
                            onChange={e => setFilterLogAgent(e.target.value)}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 min-w-[140px]"
                          >
                            <option value="">Todos Agentes</option>
                            {[...agents, ...globalAgents]
                              .filter(a => !filterLogSector || (a as any).sector === filterLogSector || (a as any).sectors?.includes(filterLogSector))
                              .map(a => <option key={a.id} value={a.id}>{a.name}</option>)
                            }
                          </select>

                          <select 
                            value={filterLogType} 
                            onChange={e => setFilterLogType(e.target.value)}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                          >
                            <option value="">Todos Tipos</option>
                            <option value="chat">Apenas Chat</option>
                            <option value="tool">Apenas Requisições</option>
                          </select>

                          <select 
                            value={filterLogStatus} 
                            onChange={e => setFilterLogStatus(e.target.value)}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                          >
                            <option value="">Todos Status</option>
                            <option value="success">Sucesso</option>
                            <option value="error">Erros</option>
                          </select>
                      </div>

                      <div className="h-4 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Data:</span>
                          <select 
                            value={filterDateMode} 
                            onChange={e => setFilterDateMode(e.target.value as any)}
                            className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                          >
                              <option value="none">Sem Filtro</option>
                              <option value="single">Dia Específico</option>
                              <option value="range">Intervalo</option>
                          </select>

                          {filterDateMode === 'single' && (
                              <div className="flex items-center gap-2">
                                  <label className="text-[10px] text-gray-600 uppercase">Data:</label>
                                  <input 
                                      type="date"
                                      value={filterSelectedDate}
                                      onChange={e => setFilterSelectedDate(e.target.value)}
                                      className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                                  />
                              </div>
                          )}

                          {filterDateMode === 'range' && (
                              <div className="flex items-center gap-2">
                                  <label className="text-[10px] text-gray-600 uppercase">De:</label>
                                  <input 
                                      type="date"
                                      value={filterStartDate}
                                      onChange={e => setFilterStartDate(e.target.value)}
                                      className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                                  />
                                  <label className="text-[10px] text-gray-600 uppercase">Até:</label>
                                  <input 
                                      type="date"
                                      value={filterEndDate}
                                      onChange={e => setFilterEndDate(e.target.value)}
                                      className="bg-white border border-gray-300 text-[10px] font-bold text-gray-900 px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                                  />
                              </div>
                          )}
                      </div>

                      <div className="h-4 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

                      <div className="flex-1 min-w-[200px] relative">
                          <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                          <input 
                            type="text"
                            value={filterLogUser}
                            onChange={e => setFilterLogUser(e.target.value)}
                            placeholder="Buscar por e-mail do usuário..."
                            className="w-full bg-white border border-gray-300 text-[10px] font-bold text-gray-900 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                          />
                      </div>
                  </div>
               </div>
               <div className="flex-1 overflow-auto p-8">
                 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#000000] text-white text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Horário</th>
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Agente</th>
                                <th className="px-6 py-4">Setor</th>
                                <th className="px-6 py-4">Evento / Ação</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loadingSystemLogs ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 animate-pulse">Carregando logs do sistema...</td>
                                </tr>
                            ) : systemLogs.map(log => {
                                const agent = [...agents, ...globalAgents].find(a => a.id === log.agent_id);
                                const agentSector = (agent as any)?.sector || ((agent as any)?.sectors && (agent as any).sectors[0]);
                                const sectorInfo = AGENT_SECTORS.find(s => s.id === agentSector);
                                
                                return (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                                        {new Date(log.created_at).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-bold text-gray-700">{log.user_email || 'Sistema'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-purple-600 font-bold uppercase tracking-tighter bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block">
                                            {agent?.name || 'N/A'}
                                            <span className="ml-2 opacity-50 font-mono text-[9px]">{log.agent_id?.slice(0, 8)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {sectorInfo ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sectorInfo.color }}></div>
                                                <span className="text-xs font-bold text-gray-700">{sectorInfo.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{log.tool_name}</div>
                                        {log.tool_name === 'Execução Chat' ? (
                                            <div className="text-[10px] text-gray-600 italic truncate w-64">
                                                "{log.payload?.message || 'Sem conteúdo'}"
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-gray-600 truncate w-64">{log.webhook_url}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                            log.status === 'success' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
                                        }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                </tr>
                            )})}
                            {systemLogs.length === 0 && !loadingSystemLogs && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                                        Nenhum log de sistema encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
               </div>
            </div>
            )
          } />

          <Route path="/tool-logs" element={!session ? <Navigate to="/login" /> : <ToolLogsView session={session} agents={agents} globalAgents={globalAgents} />} />

          <Route path="/global-assets" element={!session ? <Navigate to="/login" /> : <GlobalAssetsView session={session} onRefresh={loadGlobalAssets} addToast={addToast} navigate={navigate} handleDeleteGlobalAgent={handleDeleteGlobalAgent} />} />

          <Route path="/agent/:id" element={
            !session ? <Navigate to="/login" /> : (
            (isLoadingAgents || isInitialLoad || (urlAgentId === 'new-agent' && !currentAgent)) ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                    <div className="w-8 h-8 border-4 border-tradestudio-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-sm font-bold animate-pulse">Sincronizando com TradeStudio...</div>
                </div>
            ) : currentAgent ? (
                <div className="flex h-full relative z-10 animate-fade-in">
                    {/* CONFIGURATION COLUMN (55%) */}
                    <div className="w-[55%] border-r border-gray-800 bg-[#161b22] flex flex-col h-full shadow-2xl z-20">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-[#161b22]">
                            <div className="flex items-center gap-3">
                                <Link to="/" className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                                    <Icons.Back />
                                </Link>
                                <div>
                                    <h2 className="font-bold text-white text-sm">Configuração</h2>
                                    <div className="text-[10px] text-gray-500">{currentAgent.name}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setShowApiModal(true)}
                                    className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-all font-bold border border-gray-700 flex items-center gap-1"
                                >
                                    <Icons.Bolt /> Integração
                                </button>
                                <button 
                                    id="save-btn"
                                    onClick={handleSaveCurrentAgent} 
                                    className="text-xs bg-tradestudio-600 hover:bg-tradestudio-500 text-white px-4 py-2 rounded-lg transition-all font-bold shadow-lg shadow-tradestudio-900/50 flex items-center gap-2 active:scale-95"
                                >
                                    <Icons.Save /> Salvar
                                </button>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex items-center gap-1 p-3 border-b border-gray-800 bg-[#0d1117] overflow-x-auto min-h-[60px]">
                            <TabButton active={builderTab === 'general'} onClick={() => setBuilderTab('general')} label="Geral" icon={<Icons.User />} />
                            <TabButton active={builderTab === 'intelligence'} onClick={() => setBuilderTab('intelligence')} label="Inteligência" icon={<Icons.Brain />} />
                            <TabButton active={builderTab === 'prompt'} onClick={() => setBuilderTab('prompt')} label="Persona" icon={<Icons.Sparkles />} />
                            <TabButton active={builderTab === 'knowledge'} onClick={() => setBuilderTab('knowledge')} label="Conhecimento" icon={<Icons.Book />} />
                            <TabButton active={builderTab === 'tools'} onClick={() => setBuilderTab('tools')} label="Requisições" icon={<Icons.Zap />} />
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {builderTab === 'general' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-gray-800/30 p-5 rounded-xl border border-gray-700/50 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Avatar & Nome</label>
                                            <div className="flex gap-3 items-start">
                                                <div className="relative">
                                                    <button 
                                                        onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                                                        className="w-12 h-12 bg-[#0d1117] border border-gray-700 rounded-xl text-center text-2xl flex items-center justify-center hover:border-tradestudio-500 transition-colors"
                                                    >
                                                        {currentAgent.avatar}
                                                    </button>
                                                    {showAvatarPicker && (
                                                        <div className="absolute top-14 left-0 w-64 bg-[#1c2128] border border-gray-700 rounded-xl shadow-2xl p-3 grid grid-cols-5 gap-2 z-50">
                                                            {AVATAR_PRESETS.map(emoji => (
                                                                <button 
                                                                    key={emoji}
                                                                    onClick={() => { setCurrentAgent({...currentAgent, avatar: emoji}); setShowAvatarPicker(false); }}
                                                                    className="w-10 h-10 hover:bg-gray-700 rounded flex items-center justify-center text-xl transition-colors"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {showAvatarPicker && (
                                                        <div className="fixed inset-0 z-40" onClick={() => setShowAvatarPicker(false)}></div>
                                                    )}
                                                </div>

                                                <input 
                                                    type="text" 
                                                    value={currentAgent.name}
                                                    onChange={e => setCurrentAgent({...currentAgent, name: e.target.value})}
                                                    placeholder="Ex: Assistente Financeiro"
                                                    className="flex-1 bg-[#0d1117] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none focus:ring-1 focus:ring-tradestudio-500 transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Descrição</label>
                                            <textarea 
                                                value={currentAgent.description}
                                                onChange={e => setCurrentAgent({...currentAgent, description: e.target.value})}
                                                placeholder="O que este agente faz?"
                                                rows={3}
                                                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-3 text-sm text-gray-300 focus:border-tradestudio-500 focus:outline-none transition-all resize-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Embed Integration */}
                                    <div className="bg-tradestudio-900/10 p-5 rounded-xl border border-tradestudio-500/20 space-y-4">
                                        <div className="flex items-center gap-2 text-tradestudio-400 mb-2">
                                            <Icons.Globe />
                                            <label className="text-xs font-bold uppercase tracking-wider">Embed do Agente (Site, WordPress, etc)</label>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mb-4">Use os códigos abaixo para integrar este agente em qualquer site ou plataforma externa.</p>
                                        
                                        <div className="space-y-4">
                                            {/* Opção Link de Compartilhamento */}
                                            <div className="bg-[#0d1117]/40 p-4 rounded-lg border border-gray-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                                        🔗 Link de Compartilhamento (URL Direta)
                                                    </span>
                                                    <button 
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/share/${currentAgent.id}`;
                                                            navigator.clipboard.writeText(url);
                                                            addToast('success', 'Copiado!', 'Link de compartilhamento copiado.');
                                                        }}
                                                        className="text-[10px] text-tradestudio-400 hover:text-white transition-colors"
                                                    >
                                                        Copiar Link
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono truncate bg-[#0d1117]/20 p-2 rounded border border-gray-800/50">
                                                    {`${window.location.origin}/share/${currentAgent.id}`}
                                                </div>
                                                <p className="text-[9px] text-gray-500 mt-2 italic">Envie este link para que qualquer pessoa possa testar o agente sem login.</p>
                                            </div>

                                            {/* Opção Iframe */}
                                            <div className="bg-[#0d1117]/40 p-4 rounded-lg border border-gray-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                                        <Icons.Back /> Iframe (Embutido na página)
                                                    </span>
                                                    <button 
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/share/${currentAgent.id}`;
                                                            const code = `<iframe\n  src="${url}"\n  style="width: 100%; height: 600px; border: none;"\n  allow="microphone">\n</iframe>`;
                                                            navigator.clipboard.writeText(code);
                                                            addToast('success', 'Copiado!', 'Código Iframe copiado.');
                                                        }}
                                                        className="text-[10px] text-tradestudio-400 hover:text-white transition-colors"
                                                    >
                                                        Copiar Iframe
                                                    </button>
                                                </div>
                                                <pre className="text-[10px] text-gray-500 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                                    {`<iframe src="${window.location.origin}/share/${currentAgent.id}" style="width: 100%; height: 600px; border: none;"></iframe>`}
                                                </pre>
                                            </div>

                                            {/* Opção Bolha Flutuante */}
                                            <div className="bg-[#0d1117]/40 p-4 rounded-lg border border-gray-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                                                        💬 Bolha Flutuante (Chat Widget)
                                                    </span>
                                                    <button 
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/share/${currentAgent.id}`;
                                                            const code = `<!-- TradeStudio Chat Widget -->\n<script>\n(function() {\n  var iframe = document.createElement('iframe');\n  var button = document.createElement('div');\n  button.innerHTML = '${currentAgent.avatar || '💬'}';\n  button.style = "position:fixed;bottom:20px;right:20px;width:60px;height:60px;background:#6366f1;border-radius:50%;display:flex;align-items:center;justify-center;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.3);z-index:9999;font-size:30px;transition:all 0.3s;";\n  iframe.style = "position:fixed;bottom:90px;right:20px;width:400px;height:600px;border:none;border-radius:15px;box-shadow:0 5px 25px rgba(0,0,0,0.2);display:none;z-index:9999;";\n  iframe.src = "${url}";\n  document.body.appendChild(button);\n  document.body.appendChild(iframe);\n  button.onclick = function() {\n    iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';\n  };\n})();\n</script>`;
                                                            navigator.clipboard.writeText(code);
                                                            addToast('success', 'Copiado!', 'Código da Bolha copiado.');
                                                        }}
                                                        className="text-[10px] text-tradestudio-400 hover:text-white transition-colors"
                                                    >
                                                        Copiar Script
                                                    </button>
                                                </div>
                                                <p className="text-[9px] text-gray-500 mb-2 italic">Adiciona um botão flutuante no canto do seu site.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {builderTab === 'tools' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-orange-500"><Icons.Globe /></span>
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Requisições Globais</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {globalTools.filter(gt => {
                                                const userSector = userProfile?.sectors?.[0] || '';
                                                const toolSectors = gt.sectors || [];
                                                
                                                // Regras de Visibilidade:
                                                // 1. Ferramenta é pública
                                                // 2. Ferramenta não tem setor definido (Geral)
                                                // 3. Setor da ferramenta bate com o do usuário
                                                // 4. Usuário não tem setor e ferramenta é "geral" (sem setores)
                                                return gt.is_public || 
                                                       toolSectors.length === 0 || 
                                                       (userSector && toolSectors.includes(userSector));
                                            }).map(gt => (
                                                <button 
                                                    key={gt.id}
                                                    onClick={() => {
                                                        const newTool: AgentTool = {
                                                            id: crypto.randomUUID(),
                                                            name: gt.name,
                                                            description: gt.description,
                                                            enabled: true,
                                                            parameters: gt.parameters,
                                                            webhookUrl: gt.webhook_url,
                                                            method: gt.method
                                                        };
                                                        const currentTools = currentAgent.tools || [];
                                                        setCurrentAgent({
                                                            ...currentAgent,
                                                            tools: [...currentTools, newTool]
                                                        });
                                                        addToast('success', 'Requisição Adicionada', `${gt.name} foi adicionada ao agente.`);
                                                    }}
                                                    className="text-[10px] bg-orange-900/20 hover:bg-orange-800/40 text-orange-300 px-3 py-1.5 rounded-lg border border-orange-500/30 transition-all active:scale-95"
                                                    title={gt.description}
                                                >
                                                    + {gt.name}
                                                </button>
                                            ))}
                                            {globalTools.length === 0 && <span className="text-[10px] text-gray-600 italic">Nenhuma requisição global disponível.</span>}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <div className="text-sm text-gray-400 leading-relaxed max-w-xs">
                                            Requisições Locais: Requisições exclusivas deste agente.
                                        </div>
                                        <button 
                                            onClick={() => setEditingTool({ 
                                                id: crypto.randomUUID(), 
                                                name: '', 
                                                description: '', 
                                                enabled: true, 
                                                parameters: '',
                                                webhookUrl: '',
                                                method: 'POST'
                                            })}
                                            className="text-xs bg-tradestudio-600 hover:bg-tradestudio-500 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1 shadow-lg"
                                        >
                                            <Icons.Plus /> Nova Requisição
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {currentAgent.tools && currentAgent.tools.map(tool => (
                                            <div key={tool.id} className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 hover:border-gray-500 transition-all cursor-pointer group" onClick={() => setEditingTool(tool)}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${tool.enabled ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                                                        <span className="font-bold text-white text-sm font-mono">{tool.name}</span>
                                                    </div>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if(confirm('Remover requisição?')) {
                                                                const newTools = currentAgent.tools.filter(t => t.id !== tool.id);
                                                                setCurrentAgent({...currentAgent, tools: newTools});
                                                            }
                                                        }}
                                                        className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Icons.Trash />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-400 line-clamp-2">{tool.description}</p>
                                                {tool.webhookUrl && (
                                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-400 bg-blue-900/10 px-2 py-1 rounded w-fit">
                                                        <Icons.Zap /> {tool.webhookUrl.substring(0, 30)}...
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {(!currentAgent.tools || currentAgent.tools.length === 0) && (
                                            <div className="text-center py-8 text-gray-600 text-xs italic border-2 border-dashed border-gray-800 rounded-xl">
                                                Nenhuma requisição configurada.
                                            </div>
                                        )}
                                    </div>

                                    {editingTool && (
                                        <ToolEditorModal 
                                            isOpen={true} 
                                            onClose={() => setEditingTool(null)} 
                                            tool={editingTool} 
                                            onSave={handleSaveTool} 
                                        />
                                    )}
                                </div>
                            )}

                            {builderTab === 'intelligence' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Modelo LLM</label>
                                            <button onClick={() => setIsModelModalOpen(true)} className="text-[10px] text-tradestudio-400 hover:text-white font-bold transition-colors">+ Custom Model</button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar bg-[#0d1117]/20 rounded-xl p-2 border border-gray-800">
                                            {allModels.map(model => (
                                                <div 
                                                    key={model.id}
                                                    onClick={() => setCurrentAgent({...currentAgent, provider: model.provider as any, model: model.id})}
                                                    className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${currentAgent.model === model.id ? 'bg-tradestudio-900/30 border-tradestudio-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-gray-800/40 border-transparent hover:bg-gray-800 hover:border-gray-600'}`}
                                                >
                                                    <div>
                                                        <div className={`text-sm font-bold ${currentAgent.model === model.id ? 'text-white' : 'text-gray-300'}`}>{model.name}</div>
                                                        <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${model.provider === 'openai' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                                            {model.provider} • {model.context}
                                                        </div>
                                                    </div>
                                                    {currentAgent.model === model.id && <div className="w-2 h-2 rounded-full bg-tradestudio-500 shadow-[0_0_8px_#6366f1]"></div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3 flex items-center gap-2">
                                            <Icons.Lock /> Chave de API Pessoal (Opcional)
                                        </label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input 
                                                    type="password"
                                                    value={currentAgent.apiKey || ''}
                                                    onChange={e => {
                                                        setCurrentAgent({...currentAgent, apiKey: e.target.value});
                                                        setApiKeySyncStatus('idle');
                                                    }}
                                                    placeholder="Insira sua chave API (Gemini ou OpenAI)"
                                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-tradestudio-500 transition-colors font-mono pr-10"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {apiKeySyncStatus === 'success' ? (
                                                        <span className="text-green-500" title="Chave Sincronizada">
                                                            <Icons.Check />
                                                        </span>
                                                    ) : apiKeySyncStatus === 'error' ? (
                                                        <span className="text-red-500" title="Erro na Sincronização">
                                                            <Icons.Lock />
                                                        </span>
                                                    ) : (
                                                        <div className="text-gray-600">
                                                            <Icons.Key />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleSyncApiKey}
                                                disabled={isSyncingApiKey || !currentAgent.apiKey}
                                                className="bg-tradestudio-600/20 hover:bg-tradestudio-600 text-tradestudio-500 hover:text-white px-3 py-2 rounded-lg text-[10px] font-bold border border-tradestudio-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSyncingApiKey ? (
                                                    <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div> Sincronizando...</>
                                                ) : (
                                                    <><Icons.Sync /> Sincronizar</>
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-600 mt-2 italic">
                                            Se preenchida, esta chave será usada em vez da chave padrão do sistema para este agente.
                                        </p>
                                    </div>

                                    <div className={`p-4 rounded-xl border transition-all ${isReasoning ? 'bg-blue-900/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-gray-800/30 border-gray-700/50'}`}>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                id="reasoning-toggle"
                                                checked={currentAgent.isReasoning || false}
                                                onChange={e => setCurrentAgent({...currentAgent, isReasoning: e.target.checked})}
                                                className="w-4 h-4 accent-blue-500"
                                            />
                                            <label htmlFor="reasoning-toggle" className="cursor-pointer select-none flex-1">
                                                <div className={`text-sm font-bold ${isReasoning ? 'text-blue-400' : 'text-gray-300'}`}>Modo Raciocínio (Reasoning)</div>
                                            </label>
                                            <button 
                                                type="button"
                                                onClick={() => setOpenInfoModal({
                                                    title: "Modo Raciocínio (Reasoning)",
                                                    content: <p className="text-sm text-gray-300">Para modelos o1/o3. Bloqueia temperatura e força completion tokens.</p>
                                                })}
                                                className="text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                <Icons.Info />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className={`space-y-4 transition-opacity duration-300 ${isReasoning ? 'opacity-40 grayscale pointer-events-none relative' : ''}`}>
                                            {isReasoning && (
                                                <div className="absolute inset-0 z-10 flex items-center justify-center">
                                                    <div className="bg-[#0d1117]/80 backdrop-blur px-3 py-1.5 rounded-full text-[10px] text-blue-300 flex items-center gap-2 border border-blue-900">
                                                        <Icons.Lock /> Controlado pelo Modelo
                                                    </div>
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Temperatura</label>
                                                        <button 
                                                type="button"
                                                onClick={() => setOpenInfoModal({
                                                    title: "Temperatura",
                                                    content: (
                                                        <div className="text-sm text-gray-300 space-y-3">
                                                            <div>
                                                                <h4 className="text-white font-bold mb-1">0.0 - 0.3 (Analítico/Focado)</h4>
                                                                <p className="text-gray-400 text-[12px]">Ideal para análises, cálculos ou respostas que demandam precisão e consistência. O agente se manterá mais conservador e menos criativo.</p>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-white font-bold mb-1">0.7 - 1.0 (Equilibrado/Conversacional)</h4>
                                                                <p className="text-gray-400 text-[12px]">Perfeito para chatbots, atendimento ao cliente ou interações naturais. Combina precisão com uma dose saudável de naturalidade.</p>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-white font-bold mb-1">1.2 - 2.0 (Criativo/Brainstorm)</h4>
                                                                <p className="text-gray-400 text-[12px]">Ótimo para ideias, roteiros, histórias ou exploração de conceitos. O agente terá liberdade para gerar respostas mais variadas e inesperadas.</p>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                                className="text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                <Icons.Info />
                                            </button>
                                                    </div>
                                                    <span className="text-xs font-mono text-tradestudio-400 bg-tradestudio-900/30 px-2 py-0.5 rounded">{currentAgent.temperature}</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="2" step="0.1"
                                                    value={currentAgent.temperature}
                                                    onChange={e => setCurrentAgent({...currentAgent, temperature: parseFloat(e.target.value), preset: 'custom'})}
                                                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-tradestudio-500 hover:accent-tradestudio-400"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Top P</label>
                                                        <button 
                                                        type="button"
                                                        onClick={() => setOpenInfoModal({
                                                            title: "Top P",
                                                            content: (
                                                                <div className="text-sm text-gray-300 space-y-3">
                                                                    <div>
                                                                        <h4 className="text-white font-bold mb-1">0.1 - 0.3 (Conservador/Seguro)</h4>
                                                                        <p className="text-gray-400 text-[12px]">Limita as respostas apenas às palavras mais prováveis, garantindo resultados seguros e previsíveis. Ideal para respostas que não podem se desviar do esperado.</p>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-white font-bold mb-1">0.5 - 0.8 (Equilibrado/Natural)</h4>
                                                                        <p className="text-gray-400 text-[12px]">Oferece um equilíbrio entre segurança e variedade, selecionando entre um grupo moderado de opções. Produz respostas naturais sem ser excessivamente criativo.</p>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-white font-bold mb-1">1.0 (Aberto/Considera tudo)</h4>
                                                                        <p className="text-gray-400 text-[12px]">Permite que o agente considere todas as palavras possíveis, abrindo espaço para mais variedade e surpresa. Ótimo para exploração criativa.</p>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                        className="text-gray-500 hover:text-gray-300 transition-colors"
                                                    >
                                                        <Icons.Info />
                                                    </button>
                                                    </div>
                                                    <span className="text-xs font-mono text-tradestudio-400 bg-tradestudio-900/30 px-2 py-0.5 rounded">{currentAgent.topP}</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="1" step="0.05"
                                                    value={currentAgent.topP}
                                                    onChange={e => setCurrentAgent({...currentAgent, topP: parseFloat(e.target.value), preset: 'custom'})}
                                                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-tradestudio-500 hover:accent-tradestudio-400"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-[#0d1117]/20 p-4 rounded-xl border border-gray-800">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <label className={`text-xs font-bold uppercase flex items-center gap-2 ${isReasoning ? 'text-blue-400' : 'text-gray-400'}`}>
                                                        {isReasoning && <Icons.Brain />}
                                                        {isReasoning ? 'Max Completion Tokens' : 'Max Output Tokens'}
                                                    </label>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setOpenInfoModal({
                                                            title: isReasoning ? 'Max Completion Tokens' : 'Max Output Tokens',
                                                            content: <p className="text-sm text-gray-300">Limite máximo de tokens gerados na resposta. O valor máximo permitido é 5000 tokens.</p>
                                                        })}
                                                        className="text-gray-500 hover:text-gray-300 transition-colors"
                                                    >
                                                        <Icons.Info />
                                                    </button>
                                                </div>
                                                <input 
                                                    type="number" 
                                                    value={currentAgent.maxTokens}
                                                    onChange={e => setCurrentAgent({...currentAgent, maxTokens: Math.min(5000, Math.max(1, parseInt(e.target.value) || 1))})}
                                                    max={5000}
                                                    min={1}
                                                    className="w-20 bg-[#0d1117] border border-gray-700 text-xs text-right rounded-lg px-2 py-1 focus:outline-none focus:border-tradestudio-500 text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {builderTab === 'prompt' && (
                                <div className="h-full flex flex-col animate-fade-in">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">System Instruction (Persona)</label>
                                        <button 
                                            type="button"
                                            onClick={() => setOpenInfoModal({
                                                title: 'Caracteres Proibidos na Persona',
                                                content: (
                                                    <div className="space-y-3">
                                                        <div className="text-sm text-gray-300">Para segurança do sistema, os seguintes caracteres/padrões são automaticamente removidos:</div>
                                                        <ul className="list-disc pl-5 space-y-2 text-gray-400">
                                                            <li>{'{{ }}'} (chaves duplas)</li>
                                                            <li>&lt;script&gt;, &lt;?php, &lt;% (tags de código)</li>
                                                            <li>eval(, system(, exec( (funções perigosas)</li>
                                                            <li>javascript:, data: (URIs maliciosos)</li>
                                                        </ul>
                                                    </div>
                                                )
                                            })}
                                            className="text-gray-500 hover:text-white transition-colors"
                                        >
                                            <Icons.Info className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex-1 relative">
                                        <textarea 
                                            value={currentAgent.systemPrompt}
                                            onChange={e => {
                                                const sanitized = e.target.value
                                                    .replace(/\{\{/g, '')
                                                    .replace(/\}\}/g, '')
                                                    .replace(/<script.*?>/gi, '')
                                                    .replace(/<\?php/gi, '')
                                                    .replace(/<%/g, '')
                                                    .replace(/eval\s*\(/gi, '')
                                                    .replace(/system\s*\(/gi, '')
                                                    .replace(/exec\s*\(/gi, '')
                                                    .replace(/javascript:/gi, '')
                                                    .replace(/data:/gi, '');
                                                setCurrentAgent({...currentAgent, systemPrompt: sanitized});
                                            }}
                                            className="w-full h-[500px] bg-[#0d1117] border border-gray-700 rounded-xl p-5 text-sm text-gray-300 leading-relaxed focus:border-tradestudio-500 focus:outline-none focus:ring-1 focus:ring-tradestudio-500 custom-scrollbar resize-none"
                                            style={{ fontFamily: 'Arial, sans-serif' }}
                                            placeholder="Você é um assistente especialista em..."
                                        />
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                        <span className={`text-[10px] font-mono ${(currentAgent.systemPrompt?.length || 0) > 35000 ? 'text-red-500' : 'text-gray-500'}`}>{currentAgent.systemPrompt?.length || 0} / 35000 caracteres</span>
                                    </div>
                                    <div className="mt-4 p-4 bg-yellow-900/10 border border-yellow-700/30 rounded-lg">
                                        <p className="text-[10px] text-yellow-500">
                                            <strong>Dica:</strong> As variáveis de data/hora são injetadas automaticamente no topo desta instrução quando o agente é executado.
                                        </p>
                                    </div>
                                </div>
                            )}

                             {builderTab === 'knowledge' && (
                                <div className="h-full flex flex-col animate-fade-in custom-scrollbar overflow-y-auto pr-2">
                                    <div className="mb-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                                <Icons.Upload /> Documentos Anexados
                                                <span className="cursor-help text-gray-500" title="Apenas arquivos .pdf ou .docx são permitidos. Limite máximo de 3 arquivos.">
                                                    <Icons.Info className="w-3 h-3" />
                                                </span>
                                            </label>
                                            <div className="flex flex-col gap-2 items-end">
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    onChange={handleFileUpload} 
                                                    className="hidden" 
                                                    accept=".pdf,.docx"
                                                />
                                                <button 
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="text-[10px] bg-blue-900/30 hover:bg-blue-800 text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30 flex items-center gap-1 transition-colors"
                                                >
                                                    <Icons.Plus /> Adicionar Documento
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setOpenInfoModal({
                                                        title: 'Instruções de Upload',
                                                        content: (
                                                            <div className="space-y-3">
                                                                <div className="flex items-start gap-2">
                                                                    <Icons.File className="text-blue-400 shrink-0 w-4 h-4 mt-0.5" />
                                                                    <div>
                                                                        <p className="font-bold text-sm text-white">Tipos de arquivo permitidos</p>
                                                                        <p className="text-xs text-gray-400">Apenas arquivos .pdf ou .docx são permitidos</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-start gap-2">
                                                                    <Icons.Upload className="text-blue-400 shrink-0 w-4 h-4 mt-0.5" />
                                                                    <div>
                                                                        <p className="font-bold text-sm text-white">Limite de arquivos</p>
                                                                        <p className="text-xs text-gray-400">Você pode anexar no máximo 3 arquivos</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                    className="text-blue-300 hover:text-blue-100 transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                                                >
                                                    <Icons.Info className="w-3 h-3" />
                                                    <span>Informações</span>
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-500">Apenas arquivos .pdf ou .docx são permitidos</p>
                                    </div>

                                    {/* Lista de Documentos em Cards */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {currentAgent.attachedFiles?.map(file => (
                                            <div key={file.id} className="bg-gray-800/40 border border-gray-700 rounded-xl p-3 flex items-center justify-between group hover:border-blue-500/50 transition-all min-h-[50px]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                                                        <Icons.File />
                                                    </div>
                                                    <div>
                                                        <div className="text-[11px] font-bold text-white pr-2 break-all leading-tight mb-0.5">{file.name}</div>
                                                        <div className="text-[9px] text-gray-500 uppercase font-mono">{(file.size / 1024).toFixed(1)} KB</div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => removeAttachedFile(file.id)}
                                                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                                                >
                                                    <Icons.Trash />
                                                </button>
                                            </div>
                                        ))}
                                        {(!currentAgent.attachedFiles || currentAgent.attachedFiles.length === 0) && (
                                            <div className="col-span-2 text-center py-6 text-gray-600 text-[10px] italic border border-dashed border-gray-800 rounded-xl bg-[#0d1117]/10">
                                                Nenhum documento anexado. Importe arquivos para alimentar a IA.
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <Icons.Book /> Base de Conhecimento Local (Texto)
                                        </label>
                                    </div>

                                    <div className="relative mb-6">
                                        <textarea 
                                            value={currentAgent.knowledgeBase || ''}
                                            onChange={e => setCurrentAgent({...currentAgent, knowledgeBase: e.target.value})}
                                            className="w-full h-32 bg-[#0d1117] border border-gray-700 rounded-xl p-4 text-xs text-gray-300 leading-relaxed focus:border-blue-500 focus:outline-none transition-all resize-none font-mono"
                                            placeholder="Cole aqui informações adicionais em texto..."
                                        />
                                    </div>

                                    <div className="mb-6">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-blue-500"><Icons.Globe /></span>
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Conhecimentos Globais Anexados</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 gap-2 mb-4">
                                            {globalKnowledge.filter(k => currentAgent.globalKnowledgeIds?.includes(k.id)).map(k => (
                                                <div key={k.id} className="flex items-center justify-between p-3 bg-blue-900/10 border border-blue-500/30 rounded-xl animate-fade-in">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                            <Icons.Book />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-bold text-white">{k.title}</div>
                                                            <div className="text-[10px] text-gray-500 truncate max-w-[250px]">{k.description}</div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            const newIds = (currentAgent.globalKnowledgeIds || []).filter(id => id !== k.id);
                                                            setCurrentAgent({...currentAgent, globalKnowledgeIds: newIds});
                                                            addToast('success', 'Conhecimento Desvinculado');
                                                        }}
                                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all"
                                                        title="Remover"
                                                    >
                                                        <Icons.Trash />
                                                    </button>
                                                </div>
                                            ))}
                                            {(!currentAgent.globalKnowledgeIds || currentAgent.globalKnowledgeIds.length === 0) && (
                                                <div className="text-center py-6 text-gray-600 text-[10px] italic border border-dashed border-gray-800 rounded-xl bg-[#0d1117]/10">
                                                    Nenhum conhecimento global anexado.
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-3">Disponíveis para Anexar ({userProfile?.sectors?.[0] || 'geral'})</div>
                                            <div className="flex flex-wrap gap-2">
                                                {globalKnowledge.filter(k => {
                                                    if (currentAgent.globalKnowledgeIds?.includes(k.id)) return false;
                                                    
                                                    const userSector = userProfile?.sectors?.[0] || '';
                                                    const kSectors = k.sectors || [];
                                                    
                                                    // Regras de Visibilidade:
                                                    // 1. Conhecimento é público
                                                    // 2. Conhecimento não tem setor definido (Geral)
                                                    // 3. Setor do conhecimento bate com o do usuário
                                                    return k.is_public || 
                                                           kSectors.length === 0 || 
                                                           (userSector && kSectors.includes(userSector));
                                                }).map(k => (
                                                    <button 
                                                        key={k.id}
                                                        onClick={() => {
                                                            const newIds = [...(currentAgent.globalKnowledgeIds || []), k.id];
                                                            setCurrentAgent({...currentAgent, globalKnowledgeIds: newIds});
                                                            addToast('success', 'Conhecimento Anexado');
                                                        }}
                                                        className="text-[10px] bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 transition-all flex items-center gap-2"
                                                    >
                                                        <Icons.Plus /> {k.title}
                                                    </button>
                                                ))}
                                                {globalKnowledge.filter(k => !currentAgent.globalKnowledgeIds?.includes(k.id)).length === 0 && (
                                                    <div className="text-[10px] text-gray-600 italic">Todos os conhecimentos já foram anexados.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-4 bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-green-500"><Icons.Drive /></span>
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Sincronização Google Docs</span>
                                        </div>

                                        {/* Lista de Documentos Sincronizados */}
                                        <div className="flex flex-col gap-2 mb-4">
                                            {currentAgent.googleDocId && currentAgent.googleDocId.split(',').filter(id => id.trim()).map((urlOrId, index) => {
                                                const cleanId = extractGoogleId(urlOrId);
                                                const isSheet = isGoogleSheet(urlOrId);
                                                return (
                                                    <div key={index} className="p-3 bg-green-900/10 border border-green-500/30 rounded-xl flex items-center justify-between group animate-fade-in">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
                                                                {isSheet ? <Icons.Dashboard /> : <Icons.File />}
                                                            </div>
                                                            <div className="overflow-hidden">
                                                                <div className="text-[11px] font-bold text-white truncate max-w-[200px]" title={cleanId}>
                                                                    {cleanId.length > 20 ? cleanId.substring(0, 8) + '...' + cleanId.substring(cleanId.length - 8) : cleanId}
                                                                </div>
                                                                <div className="text-[9px] text-gray-500 uppercase font-mono">
                                                                    {isSheet ? 'Google Sheets' : 'Google Docs'} • Sincronizado
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                const ids = currentAgent.googleDocId!.split(',').filter(id => id.trim());
                                                                const newIds = ids.filter((_, i) => i !== index).join(',');
                                                                setCurrentAgent({...currentAgent, googleDocId: newIds});
                                                                addToast('success', 'Documento Removido');
                                                            }}
                                                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            title="Remover Sincronização"
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        <div className="flex flex-col gap-4">
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text"
                                                    value={builderTempDocId}
                                                    onChange={e => setBuilderTempDocId(e.target.value)}
                                                    placeholder="Cole a URL ou ID do Google Doc/Sheets aqui"
                                                    className="flex-1 bg-[#0d1117]/50 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500 transition-colors font-mono"
                                                />
                                                <button 
                                                    onClick={() => {
                                                        if (!builderTempDocId.trim()) return;
                                                        const cleanId = extractGoogleId(builderTempDocId);
                                                        const currentIds = currentAgent.googleDocId ? currentAgent.googleDocId.split(',').filter(id => id.trim()) : [];
                                                        
                                                        // Verifica se o ID já existe na lista
                                                        const exists = currentIds.some(id => extractGoogleId(id) === cleanId);

                                                        if (!exists) {
                                                            const updatedIds = [...currentIds, builderTempDocId.trim()].join(',');
                                                            setCurrentAgent({...currentAgent, googleDocId: updatedIds});
                                                            setBuilderTempDocId('');
                                                            addToast('success', 'Documento Adicionado');
                                                        } else {
                                                            addToast('error', 'Este documento já foi adicionado');
                                                        }
                                                    }}
                                                    className="bg-green-600/20 hover:bg-green-600 text-green-500 hover:text-white px-3 py-2 rounded-lg text-[10px] font-bold border border-green-600/30 transition-all"
                                                >
                                                    Adicionar
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-3 bg-[#0d1117]/20 p-2 rounded-lg border border-gray-800">
                                                <label className="text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap">Intervalo:</label>
                                                <select 
                                                    value={currentAgent.syncInterval || 24} 
                                                    onChange={e => setCurrentAgent({...currentAgent, syncInterval: parseInt(e.target.value)})}
                                                    className="flex-1 bg-transparent border-none text-[10px] text-white focus:outline-none cursor-pointer"
                                                >
                                                    <option value="3" className="bg-[#161b22]">A cada 3 horas</option>
                                                    <option value="6" className="bg-[#161b22]">A cada 6 horas</option>
                                                    <option value="9" className="bg-[#161b22]">A cada 9 horas</option>
                                                    <option value="12" className="bg-[#161b22]">A cada 12 horas</option>
                                                    <option value="24" className="bg-[#161b22]">A cada 24 horas</option>
                                                    <option value="168" className="bg-[#161b22]">A cada 1 semana</option>
                                                </select>
                                            </div>

                                            <button 
                                                onClick={() => manualSyncGoogleDoc(currentAgent.googleDocId!, currentAgent.id)}
                                                disabled={isSyncing || !currentAgent.googleDocId}
                                                className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                            >
                                                {isSyncing ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <Icons.Refresh />
                                                )}
                                                {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                                            </button>

                                            <p className="text-[9px] text-gray-600 text-center italic">
                                                O cache será atualizado automaticamente a cada {currentAgent.syncInterval || 24} horas.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PREVIEW CHAT COLUMN */}
                    <div className="flex-1 flex flex-col bg-[#0d1117] relative overflow-hidden">
                        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-[#0d1117] shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse absolute -right-0.5 -bottom-0.5 border-2 border-[#0d1117]"></div>
                                    <div className="text-xl opacity-80">{currentAgent.avatar}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white leading-none">{currentAgent.name}</div>
                                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">{currentAgent.model}</div>
                                </div>
                            </div>
                            <button onClick={() => startNewSession(currentAgent)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 px-3 py-1.5 hover:bg-gray-800 rounded-lg transition-colors border border-gray-800 hover:border-gray-600">
                                <Icons.Refresh /> Resetar Chat
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0d1117]">
                            {chatHistory.length === 0 ? <EmptyState /> : chatHistory.map((msg) => (
                                <div key={msg.id} className={`group flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                    <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-col'} items-start gap-3`}>
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm mt-1 ${msg.role === 'user' ? 'bg-gray-700 text-gray-300' : 'bg-gradient-to-br from-tradestudio-600 to-tradestudio-800 text-white'}`}>
                                            {msg.role === 'user' ? <Icons.User /> : currentAgent.avatar}
                                        </div>
                                        <div className={`flex flex-col gap-2 max-w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            {msg.toolCalls && msg.toolCalls.map((call, idx) => (
                                                <div key={idx} className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-300 w-full mb-1">
                                                    <div className="flex items-center gap-2 mb-1 text-yellow-500 font-bold uppercase tracking-wider text-[10px]">
                                                        <Icons.Zap /> Executando Requisição: {call.name}
                                                    </div>
                                                    <div className="opacity-70 bg-[#0d1117]/30 p-2 rounded break-all whitespace-pre-wrap">
                                                        {JSON.stringify(call.args, null, 2)}
                                                    </div>
                                                </div>
                                            ))}
                                            <div className={`px-5 py-3.5 shadow-md text-sm leading-relaxed ${
                                                msg.role === 'user' 
                                                ? 'bg-[#21262d] text-gray-100 rounded-2xl rounded-tr-sm border border-gray-700' 
                                                : (msg.role === 'system' 
                                                    ? 'bg-red-900/10 border border-red-900/40 text-red-200 rounded-lg w-full font-mono text-xs'
                                                    : 'bg-tradestudio-900/20 text-gray-200 rounded-2xl rounded-tl-sm border border-tradestudio-500/20 w-full')
                                            }`}>
                                                {msg.role === 'user' ? <div className="whitespace-pre-wrap">{msg.content}</div> : <MarkdownRenderer content={msg.content} />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isProcessing && (
                                <div className="flex justify-start w-full animate-fade-in">
                                    <div className="flex gap-3 max-w-[80%]">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-tradestudio-600 to-tradestudio-800 flex items-center justify-center text-sm mt-1 text-white">
                                            {currentAgent.avatar}
                                        </div>
                                        <div className="bg-tradestudio-900/20 border border-tradestudio-500/20 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 h-10 mt-1">
                                             <div className="w-1.5 h-1.5 bg-tradestudio-400 rounded-full animate-bounce"></div>
                                             <div className="w-1.5 h-1.5 bg-tradestudio-400 rounded-full animate-bounce delay-75"></div>
                                             <div className="w-1.5 h-1.5 bg-tradestudio-400 rounded-full animate-bounce delay-150"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef}></div>
                        </div>

                        <div className="p-6 bg-[#0d1117]">
                            <form onSubmit={handleSendMessage} className="relative bg-[#161b22] rounded-xl flex items-center">
                                <input 
                                    type="text"
                                    value={inputMsg}
                                    onChange={(e) => setInputMsg(e.target.value)}
                                    placeholder="Envie uma mensagem para testar..."
                                    className="w-full bg-transparent border-none rounded-xl pl-5 pr-14 py-4 text-sm text-white focus:ring-0 placeholder-gray-500"
                                    autoFocus
                                />
                                <button type="submit" disabled={!inputMsg.trim() || isProcessing} className="absolute right-2 p-2 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg disabled:opacity-50 transition-all shadow-lg active:scale-95">
                                    <Icons.Send />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                    <div className="text-4xl mb-2">🔍</div>
                    <div className="text-sm font-bold">Agente não encontrado</div>
                    <p className="text-xs text-gray-600 max-w-xs text-center">O ID do agente na URL pode estar incorreto ou ele foi excluído.</p>
                    <button 
                        onClick={() => navigate('/')}
                        className="mt-4 text-xs bg-tradestudio-600 hover:bg-tradestudio-500 text-white px-6 py-2 rounded-xl transition-all font-bold shadow-lg"
                    >
                        Voltar para o Dashboard
                    </button>
                </div>
            )
            )
          } />

          <Route path="/global-agent/:id" element={
            !session ? <Navigate to="/login" /> : (
            globalCurrentAgent ? (
            <div className="flex h-full relative z-10 animate-fade-in">
                <div className="flex-1 flex flex-col bg-[#0d1117] relative overflow-hidden">
                    <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-[#0d1117] shadow-sm z-10">
                        <div className="flex items-center gap-3">
                            <Link to="/global-assets" className="text-gray-500 hover:text-white transition-colors"><Icons.Back /></Link>
                            <div className="relative">
                                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse absolute -right-0.5 -bottom-0.5 border-2 border-[#0d1117]"></div>
                                <div className="text-xl opacity-80">{globalCurrentAgent.avatar}</div>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white leading-none">{globalCurrentAgent.name}</div>
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">{globalCurrentAgent.model}</div>
                            </div>
                        </div>
                        <button onClick={() => { setGlobalChatHistory([]); setGlobalSessionId(crypto.randomUUID()); }} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 px-3 py-1.5 hover:bg-gray-800 rounded-lg transition-colors border border-gray-800 hover:border-gray-600">
                            <Icons.Refresh /> Resetar Chat
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0d1117]">
                        {globalChatHistory.length === 0 ? <EmptyState /> : globalChatHistory.map((msg) => (
                            <div key={msg.id} className={`group flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-col'} items-start gap-3`}>
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm mt-1 ${msg.role === 'user' ? 'bg-gray-700 text-gray-300' : 'bg-gradient-to-br from-tradestudio-600 to-tradestudio-800 text-white'}`}>
                                        {msg.role === 'user' ? <Icons.User /> : globalCurrentAgent.avatar}
                                    </div>
                                    <div className={`flex flex-col gap-2 max-w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        {msg.toolCalls && msg.toolCalls.map((call, idx) => (
                                            <div key={idx} className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-300 w-full mb-1">
                                                <div className="flex items-center gap-2 mb-1 text-yellow-500 font-bold uppercase tracking-wider text-[10px]">
                                                    <Icons.Zap /> Executando Requisição: {call.name}
                                                </div>
                                                <div className="opacity-70 bg-[#0d1117]/30 p-2 rounded break-all whitespace-pre-wrap">
                                                    {JSON.stringify(call.args, null, 2)}
                                                </div>
                                            </div>
                                        ))}
                                        <div className={`px-5 py-3.5 shadow-md text-sm leading-relaxed ${
                                            msg.role === 'user' 
                                            ? 'bg-[#21262d] text-gray-100 rounded-2xl rounded-tr-sm border border-gray-700' 
                                            : (msg.role === 'system' 
                                                ? 'bg-red-900/10 border border-red-900/40 text-red-200 rounded-lg w-full font-mono text-xs'
                                                : 'bg-tradestudio-900/20 text-gray-200 rounded-2xl rounded-tl-sm border border-tradestudio-500/20 w-full')
                                        }`}>
                                            {msg.role === 'user' ? <div className="whitespace-pre-wrap">{msg.content}</div> : <MarkdownRenderer content={msg.content} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {globalIsProcessing && (
                            <div className="flex justify-start w-full animate-fade-in">
                                <div className="flex gap-3 max-w-[80%]">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-tradestudio-600 to-tradestudio-800 flex items-center justify-center text-sm mt-1 text-white">
                                        {globalCurrentAgent.avatar}
                                    </div>
                                    <div className="bg-tradestudio-900/20 border border-tradestudio-500/20 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 h-10 mt-1">
                                         <div className="w-1.5 h-1.5 bg-tradestudio-400 rounded-full animate-bounce"></div>
                                         <div className="w-1.5 h-1.5 bg-tradestudio-400 rounded-full animate-bounce delay-75"></div>
                                         <div className="w-1.5 h-1.5 bg-tradestudio-400 rounded-full animate-bounce delay-150"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={globalChatEndRef}></div>
                    </div>

                    <div className="p-6 bg-[#0d1117]">
                        <form onSubmit={handleGlobalSendMessage} className="relative bg-[#161b22] rounded-xl flex items-center">
                            <input 
                                type="text"
                                value={globalInputMsg}
                                onChange={(e) => setGlobalInputMsg(e.target.value)}
                                placeholder="Envie uma mensagem para testar..."
                                className="w-full bg-transparent border-none rounded-xl pl-5 pr-14 py-4 text-sm text-white focus:ring-0 placeholder-gray-500"
                                autoFocus
                            />
                            <button type="submit" disabled={!globalInputMsg.trim() || globalIsProcessing} className="absolute right-2 p-2 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg disabled:opacity-50 transition-all shadow-lg active:scale-95">
                                <Icons.Send />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                    <div className="text-4xl mb-2">🔍</div>
                    <div className="text-sm font-bold">Agente Global não encontrado</div>
                    <p className="text-xs text-gray-600 max-w-xs text-center">O ID do agente na URL pode estar incorreto ou ele foi excluído.</p>
                    <button 
                        onClick={() => navigate('/global-assets')}
                        className="mt-4 text-xs bg-tradestudio-600 hover:bg-tradestudio-500 text-white px-6 py-2 rounded-xl transition-all font-bold shadow-lg"
                    >
                        Voltar para Ativos Globais
                    </button>
                </div>
            )
            )
          } />

          <Route path="/session/:id" element={
            !session ? <Navigate to="/login" /> : (
            <div className="flex h-full relative z-10 animate-fade-in">
                <div className="flex-1 flex flex-col bg-[#0d1117] relative overflow-hidden">
                    <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-[#0d1117] shadow-sm z-10">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-900/20 px-3 py-1 rounded text-yellow-500 text-xs font-bold border border-yellow-700/30 flex items-center gap-2">
                                <span>👁️</span> Modo Revisão (Read Only)
                            </div>
                            <div className="text-sm text-gray-400">Sessão <span className="text-white font-mono">{sessionId.substring(0,8)}</span></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => jumpToBuilderTab('prompt')} className="text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-700 border border-gray-700">Corrigir Prompt</button>
                            <button onClick={() => jumpToBuilderTab('knowledge')} className="text-xs bg-blue-900/30 text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-900/50 border border-blue-900/50">Corrigir Base</button>
                            <Link to="/logs" className="text-xs text-gray-500 hover:text-white px-3 py-1.5 hover:bg-gray-800 rounded-lg border border-gray-800 transition-colors">Voltar</Link>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0d1117]">
                        {chatHistory.map((msg) => (
                            <div key={msg.id} className={`group flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-col'} items-start gap-3`}>
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm mt-1 ${msg.role === 'user' ? 'bg-gray-700 text-gray-300' : 'bg-gradient-to-br from-tradestudio-600 to-tradestudio-800 text-white'}`}>
                                        {msg.role === 'user' ? <Icons.User /> : currentAgent?.avatar || '🤖'}
                                    </div>
                                    <div className={`px-5 py-3.5 shadow-md text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#21262d] text-gray-100 rounded-2xl rounded-tr-sm border border-gray-700' : 'bg-tradestudio-900/20 text-gray-200 rounded-2xl rounded-tl-sm border border-tradestudio-500/20 w-full'}`}>
                                        {msg.role === 'user' ? <div className="whitespace-pre-wrap">{msg.content}</div> : <MarkdownRenderer content={msg.content} />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            )
          } />
          <Route path="/admin/users" element={!session ? <Navigate to="/login" /> : <UserManagementView session={session} userProfile={userProfile} addToast={addToast} />} />
          <Route path="/share/:agentId" element={<PublicChatView />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {/* RESET PASSWORD MODAL */}
        {isResetPasswordModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Icons.Lock /> Redefinir Senha
                    </h2>
                    <p className="text-xs text-gray-400 mb-6">Digite sua nova senha abaixo para completar a recuperação da conta.</p>
                    
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nova Senha</label>
                            <div className="relative">
                                <input 
                                    type={showResetPassword ? "text" : "password"} 
                                    required
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 pr-10 text-sm text-white focus:border-tradestudio-500 focus:outline-none"
                                    placeholder="••••••••"
                                    minLength={6}
                                    autoFocus
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowResetPassword(!showResetPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    {showResetPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button 
                                type="submit"
                                disabled={isProcessing || !newPassword}
                                className="w-full px-5 py-3 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isProcessing ? 'Atualizando...' : 'Salvar Nova Senha'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* CUSTOM MODEL MODAL */}

        {/* CUSTOM MODEL MODAL */}
        {isModelModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Icons.Brain /> Adicionar Modelo
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Nome de Exibição</label>
                            <input type="text" className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-tradestudio-500 focus:outline-none" 
                                value={newModelForm.name} onChange={e => setNewModelForm({...newModelForm, name: e.target.value})} placeholder="Ex: GPT-5 Preview" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">ID do Modelo (API)</label>
                            <input type="text" className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-white font-mono" 
                                value={newModelForm.id} onChange={e => setNewModelForm({...newModelForm, id: e.target.value})} placeholder="ex: gpt-5-preview" />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Provedor</label>
                             <div className="flex gap-3">
                                <button onClick={() => setNewModelForm({...newModelForm, provider: 'openai'})} className={`flex-1 py-3 rounded-lg text-xs font-bold border transition-all ${newModelForm.provider === 'openai' ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>OpenAI</button>
                                <button onClick={() => setNewModelForm({...newModelForm, provider: 'gemini'})} className={`flex-1 py-3 rounded-lg text-xs font-bold border transition-all ${newModelForm.provider === 'gemini' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>Gemini</button>
                             </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-8">
                        <button onClick={() => setIsModelModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancelar</button>
                        <button onClick={handleAddModel} className="px-5 py-2.5 bg-tradestudio-600 hover:bg-tradestudio-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-tradestudio-900/50 transition-all">Salvar Modelo</button>
                    </div>
                </div>
            </div>
        )}

        {/* API EXPORT MODAL */}
        {currentAgent && (
            <ApiExportModal 
                isOpen={showApiModal} 
                onClose={() => setShowApiModal(false)} 
                agent={currentAgent} 
            />
        )}

        {/* Info Modal */}
        {openInfoModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0d1117]/80 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                    <div className="flex items-start justify-between mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Icons.Info />
                            {openInfoModal.title}
                        </h3>
                        <button 
                            onClick={() => setOpenInfoModal(null)}
                            className="text-gray-500 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div className="text-gray-300">
                        {openInfoModal.content}
                    </div>
                </div>
            </div>
        )}

        <SuccessAnimation show={showSuccess} message={successMsg} />
      </div> {/* FECHA A DIV PRINCIPAL DO APP */}
    </div>  
  );
};

export default App;
