import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { listQrLinks, getQrLink, insertQrLink, upsertQrLink, deleteQrLink, bulkInsertQrLinks } from './api/_lib/db.js';
import { extractReviewLink } from './api/_lib/extract-link.js';
import { scanPage, isSafeRedirectUrl } from './api/_lib/scan-page.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Route to extract and resolve map link without API keys
  app.post('/api/extract-link', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      const result = await extractReviewLink(url);
      return res.status(result.status).json(result.payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to process the link' });
    }
  });

  // Admin Login Endpoint (mirrors api/admin-login.js)
  app.post('/api/admin-login', (req, res) => {
    const envUser = String(process.env.ADMIN_USERNAME || '').trim();
    const envPass = String(process.env.ADMIN_PASSWORD || '').trim();

    if (!envUser || !envPass) {
      return res.status(500).json({
        error: 'Admin login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.'
      });
    }

    const { username, password } = req.body || {};
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (cleanUser === envUser.toLowerCase() && cleanPass === envPass) {
      return res.json({
        success: true,
        user: { uid: 'admin', username: envUser, role: 'admin' }
      });
    }

    return res.status(401).json({ error: 'Invalid username or password.' });
  });

  // Bulk Generate QR Links Endpoint
  app.post('/api/bulk-generate', async (req, res) => {
    try {
      const { count } = req.body || {};
      const num = Math.floor(Number(count));
      if (!Number.isFinite(num) || num <= 0 || num > 500) {
        return res.status(400).json({ error: 'Count must be a number between 1 and 500.' });
      }
      const links = await bulkInsertQrLinks(num);
      res.json({ success: true, created: links.length, links });
    } catch (error) {
      console.error('Bulk generate error:', error);
      res.status(500).json({ error: 'Failed to bulk generate QR links.' });
    }
  });

  // QR Links API Endpoints (Admin backed)
  app.get('/api/qr-links', async (_req, res) => {
    try {
      const links = await listQrLinks();
      res.json({ success: true, links });
    } catch (error) {
      console.error('Fetch links error:', error);
      res.status(500).json({ error: 'Failed to fetch QR links.' });
    }
  });

  app.get('/api/qr-links/:id', async (req, res) => {
    try {
      const link = await getQrLink(req.params.id);
      if (!link) {
        return res.status(404).json({ error: 'QR code not found.' });
      }
      res.json({ success: true, link });
    } catch (error) {
      console.error('Fetch single link error:', error);
      res.status(500).json({ error: 'Failed to load QR code.' });
    }
  });

  app.post('/api/qr-links', async (req, res) => {
    try {
      const { destinationUrl, businessName } = req.body || {};
      const id = 'qr_' + crypto.randomBytes(6).toString('hex');
      await insertQrLink({ id, destinationUrl, businessName });
      res.json({ success: true, id });
    } catch (error) {
      console.error('Create link error:', error);
      res.status(500).json({ error: 'Failed to create QR link.' });
    }
  });

  app.put('/api/qr-links/:id', async (req, res) => {
    try {
      let { destinationUrl, businessName } = req.body || {};
      if (destinationUrl !== undefined && destinationUrl !== null) {
        destinationUrl = String(destinationUrl).trim();
        if (destinationUrl && !/^https?:\/\//i.test(destinationUrl) && !destinationUrl.startsWith('/')) {
          destinationUrl = 'https://' + destinationUrl;
        }
      }
      await upsertQrLink(req.params.id, { destinationUrl, businessName });
      res.json({ success: true, destinationUrl });
    } catch (error) {
      console.error('Update link error:', error);
      res.status(500).json({ error: 'Failed to update QR link.' });
    }
  });

  app.delete('/api/qr-links/:id', async (req, res) => {
    try {
      await deleteQrLink(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete link error:', error);
      res.status(500).json({ error: 'Failed to delete QR link.' });
    }
  });

  // Server-side Redirect for QR Scans (mirrors api/scan/[id].js)
  app.get('/scan/:id', async (req, res) => {
    const { id } = req.params;

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
      console.error('Redirect Error:', error);
      res.status(500).send('Error resolving QR code destination.');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
