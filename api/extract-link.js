import { extractReviewLink } from './_lib/extract-link.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}
