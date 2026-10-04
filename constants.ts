// Constantes compartilhadas entre o navegador (src/) e as funções de api/.
// Não colocar aqui nada que leia variável de ambiente.

export type UserRole = 'colaborador' | 'co-lider' | 'qualidade' | 'lider' | 'admin' | 'dev' | 'admin-master';

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
