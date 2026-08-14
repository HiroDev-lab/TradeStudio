import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[API TEST] Request received!', new Date().toISOString());
  return res.status(200).json({
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString(),
    body: req.body,
    query: req.query,
    headers: req.headers
  });
}
