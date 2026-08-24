import { getQrLink } from '../_lib/db.js';
import { scanPage, isSafeRedirectUrl } from '../_lib/scan-page.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).send('Invalid QR code id.');
  }

  try {
    const data = await getQrLink(id);

    if (!data) {
      return res.status(404).send('QR Code not found in database.');
    }

    if (!data.destinationUrl) {
      return res.redirect(`/setup/${id}`);
    }

    if (!isSafeRedirectUrl(data.destinationUrl)) {
      return res.status(400).send('QR code has an invalid destination URL.');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(scanPage(data.destinationUrl));
  } catch (error) {
    console.error('Scan redirect error:', error);
    res.status(500).send('Error resolving QR code destination.');
  }
}
