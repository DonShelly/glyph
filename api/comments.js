const { hasDb, sb } = require('../lib/db');

let mem = [];

function parseBody(req) {
  if (!req.body) return {};
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const limit = Math.min(100, parseInt(req.query.limit || '30', 10));
      if (hasDb()) {
        const rows = await sb(`comments?select=*&order=created_at.desc&limit=${limit}`);
        return res.status(200).json({ items: rows });
      }
      return res.status(200).json({ items: mem.slice(0, limit) });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (!body.comment) return res.status(400).json({ error: 'comment required' });
      const row = {
        artwork_id: body.artworkId || null,
        comment: body.comment,
        author: body.author || 'adrian',
        created_at: new Date().toISOString(),
      };
      if (hasDb()) {
        const out = await sb('comments', { method: 'POST', body: row });
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
