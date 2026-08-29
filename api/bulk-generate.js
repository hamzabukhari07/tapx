import { bulkInsertQrLinks } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { count } = req.body || {};
    const num = Math.floor(Number(count));
    if (!Number.isFinite(num) || num <= 0 || num > 500) {
      return res.status(400).json({ error: 'Count must be a number between 1 and 500.' });
    }

    const links = await bulkInsertQrLinks(num);
    return res.json({ success: true, created: links.length, links });
  } catch (error) {
    console.error('Bulk generate API error:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk generate QR links.' });
  }
}