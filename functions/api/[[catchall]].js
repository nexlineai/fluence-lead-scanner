// Fluence Lead Scanner — Cloudflare Pages Function
// Handles all /api/* routes: JWT auth + leads CRUD + D1

const JWT_SECRET_KEY = 'fluence-jwt-secret';

async function createToken(payload, env) {
  const secret = env[JWT_SECRET_KEY] || 'fluence-dev-secret-key-2026';
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 7 }));
  const signature = await sha256(header + '.' + body, secret);
  return header + '.' + body + '.' + signature;
}

async function verifyToken(token, env) {
  try {
    const secret = env[JWT_SECRET_KEY] || 'fluence-dev-secret-key-2026';
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const sig = await sha256(parts[0] + '.' + parts[1], secret);
    if (sig !== parts[2]) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

async function sha256(msg, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (!path.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 });
  }

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
  }

  // Auth helper
  async function getUser() {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return await verifyToken(auth.slice(7), env);
  }

  try {
    // Register
    if (path === '/api/register' && method === 'POST') {
      const { email, name, password } = await request.json();
      if (!email || !name || !password) return json({ error: 'Missing fields' }, 400);
      if (password.length < 6) return json({ error: 'Password too short' }, 400);

      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) return json({ error: 'Email already registered' }, 409);

      const secret = env[JWT_SECRET_KEY] || 'fluence-dev-secret-key-2026';
      const hash = await sha256(password, secret);
      const result = await env.DB.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').bind(email, name, hash).run();
      const userId = result.meta?.last_row_id || 0;
      const token = await createToken({ id: userId, email, name }, env);
      return json({ token, user: { id: userId, email, name } });
    }

    // Login
    if (path === '/api/login' && method === 'POST') {
      const { email, password } = await request.json();
      if (!email || !password) return json({ error: 'Missing fields' }, 400);

      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!user) return json({ error: 'Invalid credentials' }, 401);

      const secret = env[JWT_SECRET_KEY] || 'fluence-dev-secret-key-2026';
      const hash = await sha256(password, secret);
      if (hash !== user.password_hash) return json({ error: 'Invalid credentials' }, 401);

      const token = await createToken({ id: user.id, email: user.email, name: user.name }, env);
      return json({ token, user: { id: user.id, email: user.email, name: user.name } });
    }

    // Auth required from here
    const user = await getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    // GET /api/leads
    if (path === '/api/leads' && method === 'GET') {
      const { searchParams } = url;
      const assigned = searchParams.get('assigned_to') || '';
      const temp = searchParams.get('temperature') || '';
      const q = searchParams.get('q') || '';

      let sql = 'SELECT * FROM leads WHERE user_id = ?';
      let params = [user.id];

      if (assigned) { sql += ' AND assigned_to = ?'; params.push(assigned); }
      if (temp) { sql += ' AND temperature = ?'; params.push(temp); }
      if (q) { sql += ' AND (company LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; const s = '%' + q + '%'; params.push(s, s, s, s); }

      sql += ' ORDER BY created_at DESC';
      const result = await env.DB.prepare(sql).bind(...params).all();
      return json(result.results || []);
    }

    // POST /api/leads
    if (path === '/api/leads' && method === 'POST') {
      const data = await request.json();
      const result = await env.DB.prepare(
        `INSERT INTO leads (user_id, first_name, last_name, title, company, email, phone, country, linkedin,
          temperature, deal_size, timeline, products, notes, assigned_to, action, due_date, priority,
          voice_note, voice_tags, scan_text, event_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        user.id, data.first_name || '', data.last_name || '', data.title || '', data.company || '',
        data.email || '', data.phone || '', data.country || '', data.linkedin || '',
        data.temperature || '', data.deal_size || '', data.timeline || '',
        JSON.stringify(data.products || []), data.notes || '', data.assigned_to || '',
        data.action || '', data.due_date || '', data.priority || '',
        data.voice_note || '', JSON.stringify(data.voice_tags || []),
        data.scan_text || '', data.event_name || 'ISE 2026'
      ).run();
      return json({ id: result.meta?.last_row_id || 0, success: true }, 201);
    }

    // DELETE /api/leads/:id
    const deleteMatch = path.match(/^\/api\/leads\/(\d+)$/);
    if (deleteMatch && method === 'DELETE') {
      const id = parseInt(deleteMatch[1]);
      await env.DB.prepare('DELETE FROM leads WHERE id = ? AND user_id = ?').bind(id, user.id).run();
      return json({ success: true });
    }

    // DELETE /api/leads (all)
    if (path === '/api/leads' && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM leads WHERE user_id = ?').bind(user.id).run();
      return json({ success: true });
    }

    // GET /api/leads/export
    if (path === '/api/leads/export' && method === 'GET') {
      const leads = await env.DB.prepare('SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all();
      return json(leads.results || []);
    }

    // GET /api/users
    if (path === '/api/users' && method === 'GET') {
      const users = await env.DB.prepare('SELECT id, email, name FROM users').all();
      return json(users.results || []);
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return json({ error: err.message || 'Internal error' }, 500);
  }
}
