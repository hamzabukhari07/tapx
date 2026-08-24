export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      user: {
        uid: 'admin',
        username: envUser,
        role: 'admin'
      }
    });
  }

  return res.status(401).json({ error: 'Invalid username or password.' });
}
