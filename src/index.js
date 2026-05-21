// Fluence Lead Scanner - Cloudflare Worker
// Provides: JWT auth, leads CRUD, export

// Simple JWT implementation (no deps needed)
const JWT_SECRET = FLUENCE_JWT_SECRET || 'change-this-in-production';

async function createToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 7 }));
  const signature = await sha256(header + '.' + body + JWT_SECRET);
  return header + '.' + body + '.' + signature;
}

async function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const sig = await sha256(parts[0] + '.' + parts[1] + JWT_SECRET);
    if (sig !== parts[2]) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function html(resp) {
  return new Response(resp, {
    status: 200, headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }
      });
    }

    // Auth middleware
    async function getUser() {
      const auth = request.headers.get('Authorization');
      if (!auth || !auth.startsWith('Bearer ')) return null;
      return await verifyToken(auth.slice(7));
    }

    // --- PUBLIC ROUTES ---

    // Serve the app
    if (path === '/' || path === '/index.html') {
      return html(APP_HTML);
    }

    // Register
    if (path === '/api/register' && method === 'POST') {
      const { email, name, password } = await request.json();
      if (!email || !name || !password) return json({ error: 'Missing fields' }, 400);
      if (password.length < 6) return json({ error: 'Password too short' }, 400);
      
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) return json({ error: 'Email already registered' }, 409);
      
      const hash = await sha256(password + JWT_SECRET);
      const result = await env.DB.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').bind(email, name, hash).run();
      const token = await createToken({ id: result.meta?.last_row_id || result.success ? 1 : 0, email, name });
      return json({ token, user: { email, name } });
    }

    // Login
    if (path === '/api/login' && method === 'POST') {
      const { email, password } = await request.json();
      if (!email || !password) return json({ error: 'Missing fields' }, 400);
      
      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!user) return json({ error: 'Invalid credentials' }, 401);
      
      const hash = await sha256(password + JWT_SECRET);
      if (hash !== user.password_hash) return json({ error: 'Invalid credentials' }, 401);
      
      const token = await createToken({ id: user.id, email: user.email, name: user.name });
      return json({ token, user: { id: user.id, email: user.email, name: user.name } });
    }

    // --- AUTHENTICATED ROUTES ---

    const user = await getUser();

    // GET /api/leads
    if (path === '/api/leads' && method === 'GET') {
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { searchParams } = url;
      const assigned = searchParams.get('assigned_to') || '';
      const temp = searchParams.get('temperature') || '';
      const search = searchParams.get('q') || '';
      
      let sql = 'SELECT * FROM leads WHERE user_id = ?';
      let params = [user.id];
      
      if (assigned) { sql += ' AND assigned_to = ?'; params.push(assigned); }
      if (temp) { sql += ' AND temperature = ?'; params.push(temp); }
      if (search) { sql += ' AND (company LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; const s = '%' + search + '%'; params.push(s, s, s, s); }
      
      sql += ' ORDER BY created_at DESC';
      
      const result = await env.DB.prepare(sql).bind(...params).all();
      return json(result.results || []);
    }

    // POST /api/leads
    if (path === '/api/leads' && method === 'POST') {
      if (!user) return json({ error: 'Unauthorized' }, 401);
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
    if (path.match(/^\/api\/leads\/\d+$/) && method === 'DELETE') {
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const id = parseInt(path.split('/')[3]);
      await env.DB.prepare('DELETE FROM leads WHERE id = ? AND user_id = ?').bind(id, user.id).run();
      return json({ success: true });
    }

    // DELETE /api/leads (clear all)
    if (path === '/api/leads' && method === 'DELETE') {
      if (!user) return json({ error: 'Unauthorized' }, 401);
      await env.DB.prepare('DELETE FROM leads WHERE user_id = ?').bind(user.id).run();
      return json({ success: true });
    }

    // GET /api/leads/export
    if (path === '/api/leads/export' && method === 'GET') {
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const leads = await env.DB.prepare('SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all();
      return json(leads.results || []);
    }

    // GET /api/users (list reps)
    if (path === '/api/users' && method === 'GET') {
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const users = await env.DB.prepare('SELECT id, email, name, role FROM users').all();
      return json(users.results || []);
    }

    // 404
    return json({ error: 'Not found' }, 404);
  }
};
