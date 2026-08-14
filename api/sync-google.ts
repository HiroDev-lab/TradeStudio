import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  console.log(`\n--- [LOG SERVIDOR] ${timestamp} ---`);
  console.log(`[SYNC-PROXY] Recebendo requisição: ${req.method}`);

  // Configuração de CORS restrita
  const allowedOrigins = [
    'https://tradestudio-ai-studio.vercel.app',
    'https://tradestudio.com.br',
    'http://localhost:5173' // Para desenvolvimento local
  ];
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback seguro ou permitir apenas o seu domínio oficial se origin for nulo (ex: chamadas diretas de API)
    res.setHeader('Access-Control-Allow-Origin', 'https://tradestars-ai-studio.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // --- REFORÇO DE SEGURANÇA: INTEGRIDADE (HEADERS) ---
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    console.log('[SYNC-PROXY] Respondendo OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.warn(`[SYNC-PROXY] Método não permitido: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, token } = req.body;

  if (!url) {
    console.error('[SYNC-PROXY] URL não fornecida no corpo da requisição');
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`[SYNC-PROXY] Tentando baixar conteúdo de: ${url}`);
    console.log(`[SYNC-PROXY] Token presente: ${!!token}`);
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/plain, text/csv, */*'
    };

    let text = '';
    let success = false;
    
    // Try the export URL approach first (original method)
    console.log('[SYNC-PROXY] Trying export URL method...');
    if (token) {
      console.log('[SYNC-PROXY] Using token for export URL');
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    let response = await fetch(url, { headers, redirect: 'follow' });
    console.log(`[SYNC-PROXY] Export URL status: ${response.status}`);
    
    if (response.ok) {
      text = await response.text();
      if (text && text.length > 5 && !(token ? false : (text.includes('google-signin') || text.includes('Sign in - Google Accounts') || text.includes('ServiceLogin')))) {
        success = true;
        console.log('[SYNC-PROXY] Export URL method worked');
      }
    }
    
    // If export URL didn't work, try using Google Docs API
    if (!success && token) {
      console.log('[SYNC-PROXY] Trying Google Docs/Sheets API method...');
      
      // Extract document ID from the URL to know what API to use
      let docId = '';
      let isSheet = false;
      
      const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/);
      const sheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      
      if (docMatch) {
        docId = docMatch[1];
        isSheet = false;
      } else if (sheetMatch) {
        docId = sheetMatch[1];
        isSheet = true;
      }
      
      if (docId) {
        console.log(`[SYNC-PROXY] Found document ID: ${docId}, isSheet: ${isSheet}`);
        
        if (!isSheet) {
          // Try Google Docs API: export to text
          const docsApiUrl = `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`;
          const apiHeaders = {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'TradeStudio/1.0'
          };
          
          const apiResponse = await fetch(docsApiUrl, { headers: apiHeaders });
          console.log(`[SYNC-PROXY] Google Docs API status: ${apiResponse.status}`);
          
          if (apiResponse.ok) {
            text = await apiResponse.text();
            if (text && text.length > 5) {
              success = true;
              console.log('[SYNC-PROXY] Google Docs API method worked');
            }
          } else {
            const apiError = await apiResponse.text();
            console.error('[SYNC-PROXY] Google Docs API error:', apiError);
          }
        } else {
          // Try Google Sheets API: export to CSV
          const sheetsApiUrl = `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/csv`;
          const apiHeaders = {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'TradeStudio/1.0'
          };
          
          const apiResponse = await fetch(sheetsApiUrl, { headers: apiHeaders });
          console.log(`[SYNC-PROXY] Google Sheets API status: ${apiResponse.status}`);
          
          if (apiResponse.ok) {
            text = await apiResponse.text();
            if (text && text.length > 5) {
              success = true;
              console.log('[SYNC-PROXY] Google Sheets API method worked');
            }
          } else {
            const apiError = await apiResponse.text();
            console.error('[SYNC-PROXY] Google Sheets API error:', apiError);
          }
        }
      }
    }
    
    if (!success) {
      console.error('[SYNC-PROXY] All methods failed to get content');
      return res.status(403).json({ 
        error: 'Não foi possível acessar o documento',
        message: 'Certifique-se que o token é válido e que o documento está compartilhado com sua conta ou com a organização',
        serverTime: timestamp
      });
    }
    
    console.log(`[SYNC-PROXY] Conteúdo baixado com sucesso. Tamanho: ${text.length} bytes.`);
    
    console.log('[SYNC-PROXY] Enviando conteúdo para o frontend.');
    return res.status(200).send(text);

  } catch (err: any) {
    console.error(`[SYNC-PROXY] Erro fatal: ${err.message}`);
    console.error(err.stack);
    return res.status(500).json({ 
      error: 'Erro de conexão com o servidor do Google',
      details: err.message,
      serverTime: timestamp
    });
  }
}
