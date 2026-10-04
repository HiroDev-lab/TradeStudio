import type { VercelRequest, VercelResponse } from '@vercel/node';
import { preflight, requireCaller } from './_lib/http.js';
import { fetchGoogleFileText, GoogleDocError } from './_lib/google.js';

/**
 * Baixa o texto de um Google Docs/Planilhas para a base de conhecimento.
 * Só aceita links de docs.google.com — não é um proxy genérico.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, 'POST')) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const caller = await requireCaller(req, res);
  if (!caller) return;

  const url = req.body?.url;
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'Informe o link do documento.' });
  }

  try {
    const text = await fetchGoogleFileText(url);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(text);
  } catch (err: any) {
    if (err instanceof GoogleDocError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[api/sync-google] Erro:', err);
    return res.status(500).json({ error: 'Erro de conexão com o servidor do Google.' });
  }
}
