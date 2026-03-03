const fs = require('fs');
const path = require('path');
const { hasDb, sb } = require('../lib/db');

function parseBody(req) {
  if (!req.body) return {};
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

module.exports = async (req, res) => {
  try {
    const localPath = path.join(process.cwd(), 'data', 'artworks.json');
    const base = JSON.parse(fs.readFileSync(localPath, 'utf8'));

    if (req.method === 'GET') {
      let remote = [];
      if (hasDb()) {
        remote = await sb('artworks?select=payload&order=created_at.desc&limit=100');
        remote = remote.map(x => x.payload).filter(Boolean);
      }
      return res.status(200).json({ items: [...remote, ...base] });
    }

    if (req.method === 'POST') {
      const auth = req.headers.authorization || '';
      const token = auth.replace('Bearer ', '').trim();
      if (!process.env.GLYPH_DEPLOY_TOKEN || token !== process.env.GLYPH_DEPLOY_TOKEN) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      const payload = parseBody(req);
      if (!payload?.id || !payload?.defaultConfig) {
        return res.status(400).json({ error: 'id and defaultConfig required' });
      }
      if (!hasDb()) return res.status(500).json({ error: 'db not configured' });

      await sb('artworks', {
        method: 'POST',
        body: { id: payload.id, payload },
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
