const { hasDb, sb } = require('../lib/db');

let mem = [];

function parseBody(req) {
  if (!req.body) return {};
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const artworkId = req.query.artworkId;
      if (!artworkId) return res.status(400).json({ error: 'artworkId required' });
      if (hasDb()) {
        const rows = await sb(`variants?select=*&artwork_id=eq.${encodeURIComponent(artworkId)}&order=created_at.desc&limit=50`);
        return res.status(200).json({ items: rows });
      }
      return res.status(200).json({ items: mem.filter(v => v.artwork_id === artworkId) });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (!body.artworkId || !body.config) {
        return res.status(400).json({ error: 'artworkId and config required' });
      }
      const row = {
        artwork_id: body.artworkId,
        config: body.config,
        comment: body.comment || null,
        author: body.author || 'adrian',
        created_at: new Date().toISOString(),
      };
      if (hasDb()) {
        const out = await sb('variants', { method: 'POST', body: row });
        return res.status(200).json({ item: out[0] || row });
      }
      mem.unshift(row);
      return res.status(200).json({ item: row });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
