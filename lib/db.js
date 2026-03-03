const hasDb = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sb(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      'Accept-Profile': 'glyph',
      'Content-Profile': 'glyph',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? [] : res.json();
}

module.exports = { hasDb, sb };
