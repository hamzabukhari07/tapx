import { getQrLink, upsertQrLink, deleteQrLink } from '../_lib/db.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid QR link id.' });
  }

  try {
    if (req.method === 'GET') {
      const link = await getQrLink(id);
      if (!link) {
        return res.status(404).json({ error: 'QR code not found.' });
      }
      return res.json({ success: true, link });
    }

    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          // ignore
        }
      }
      let { destinationUrl, businessName } = body || {};

      if (destinationUrl !== undefined && destinationUrl !== null) {
        destinationUrl = String(destinationUrl).trim();
        if (destinationUrl && !/^https?:\/\//i.test(destinationUrl) && !destinationUrl.startsWith('/')) {
          destinationUrl = 'https://' + destinationUrl;
        }
      }

      await upsertQrLink(id, { destinationUrl, businessName });
      return res.json({ success: true, destinationUrl });
    }

    if (req.method === 'DELETE') {
      await deleteQrLink(id);
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(`QR link [${id}] API error:`, error);
    res.status(500).json({ error: error.message || 'Database request failed.' });
  }
}
