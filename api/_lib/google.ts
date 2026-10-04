// Leitura de Google Docs/Planilhas pela URL pública de exportação. Só funciona
// para arquivos compartilhados como "qualquer pessoa com o link".

export class GoogleDocError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface GoogleFileRef {
  id: string;
  isSheet: boolean;
}

/** Aceita o link do documento (de edição, visualização ou exportação) ou só o ID. */
export function parseGoogleFile(urlOrId: string): GoogleFileRef | null {
  const value = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return { id: value, isSheet: false };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;

  const match = url.pathname.match(/^\/(document|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return { id: match[2], isSheet: match[1] === 'spreadsheets' };
}

export async function fetchGoogleFileText(urlOrId: string): Promise<string> {
  const file = parseGoogleFile(urlOrId);
  if (!file) {
    throw new GoogleDocError('Link inválido. Use o link de um Google Docs ou Google Planilhas.', 400);
  }

  const exportUrl = file.isSheet
    ? `https://docs.google.com/spreadsheets/d/${file.id}/export?format=csv`
    : `https://docs.google.com/document/d/${file.id}/export?format=txt`;

  const response = await fetch(exportUrl, { redirect: 'follow' });
  const contentType = response.headers.get('content-type') || '';

  // Documento privado: o Google responde 401/403 ou redireciona para a tela de login (HTML).
  if (!response.ok || contentType.includes('text/html')) {
    throw new GoogleDocError(
      'Não foi possível ler o documento. Compartilhe-o como "Qualquer pessoa com o link" (leitor) e tente de novo.',
      403
    );
  }

  return (await response.text()).replace(/^﻿/, '');
}
