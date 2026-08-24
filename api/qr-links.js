import crypto from 'crypto';
import { listQrLinks, insertQrLink } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const links = await listQrLinks();
      return res.json({ success: true, links });
    }

    if (req.method === 'POST') {
      const { destinationUrl, businessName } = req.body || {};
      const id = 'qr_' + crypto.randomBytes(6).toString('hex');
      await insertQrLink({ id, destinationUrl, businessName });
      return res.json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('QR links API error:', error);
    res.status(500).json({ error: error.message || 'Database request failed.' });
  }
}
