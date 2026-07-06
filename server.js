const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const JWT_SECRET = process.env.JWT_SECRET || 'caderno-suporte-secret-2024';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT 'ti-user-circle',
      color TEXT DEFAULT '#880000',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      icon TEXT DEFAULT 'ti-tool',
      fixed BOOLEAN DEFAULT false,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS procedures (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      cat TEXT DEFAULT 'geral',
      status TEXT DEFAULT 'pendente',
      favorite BOOLEAN DEFAULT false,
      steps JSONB DEFAULT '[]',
      obs TEXT DEFAULT '',
      client_name TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS history (
      id BIGSERIAL PRIMARY KEY,
      proc_id BIGINT,
      title TEXT,
      cat TEXT,
      user_id TEXT,
      ts BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      author_id TEXT,
      author_name TEXT,
      date TEXT,
      done BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT DEFAULT 'Sem título',
      blocks JSONB DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*) FROM categories');
  if (parseInt(rows[0].count) === 0) {
    const defaults = [
      ['nfc','NFC','ti-device-mobile',true,0],
      ['xml','XML','ti-file-code',true,1],
      ['impressao','Impressão','ti-printer',true,2],
      ['atualizacao','Atualização','ti-refresh',true,3],
      ['instalacao','Instalação','ti-package',true,4],
      ['geral','Geral','ti-tool',true,5]
    ];
    for (const [id,label,icon,fixed,sort_order] of defaults) {
      await pool.query('INSERT INTO categories(id,label,icon,fixed,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[id,label,icon,fixed,sort_order]);
    }
  }
  console.log('✅ Banco de dados pronto');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(PUBLIC_DIR));

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────

async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Token ausente' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows: s } = await pool.query('SELECT * FROM sessions WHERE token=$1', [token]);
    if (!s.length) return res.status(401).json({ message: 'Sessão inválida' });
    const { rows: u } = await pool.query('SELECT * FROM users WHERE id=$1', [payload.id]);
    if (!u.length) return res.status(401).json({ message: 'Usuário não encontrado' });
    req.user = u[0]; req.token = token; next();
  } catch(e) { res.status(401).json({ message: 'Token inválido' }); }
}

function pub(u) { return { id:u.id, name:u.name, email:u.email, avatar:u.avatar, color:u.color }; }

// ── AUTH ROTAS ────────────────────────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Preencha todos os campos' });
    if (password.length < 6) return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres' });
    const { rows: ex } = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (ex.length) return res.status(409).json({ message: 'Este email já está cadastrado' });
    const hash = await bcrypt.hash(password, 10);
    const id = 'u_' + Date.now();
    await pool.query('INSERT INTO users(id,name,email,password) VALUES($1,$2,$3,$4)', [id, name, email, hash]);
    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
    await pool.query('INSERT INTO sessions(token,user_id) VALUES($1,$2)', [token, id]);
    const { rows: u } = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    res.json({ token, user: pub(u[0]) });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Erro ao cadastrar' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Informe email e senha' });
    const { rows } = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Email ou senha inválidos' });
    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(401).json({ message: 'Email ou senha inválidos' });
    const token = jwt.sign({ id: rows[0].id }, JWT_SECRET, { expiresIn: '30d' });
    await pool.query('INSERT INTO sessions(token,user_id) VALUES($1,$2)', [token, rows[0].id]);
    res.json({ token, user: pub(rows[0]) });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Erro ao entrar' }); }
});

app.post('/api/logout', auth, async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE token=$1', [req.token]);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json(pub(req.user)));

app.put('/api/me/password', auth, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres' });
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hash, req.user.id]);
  res.json({ ok: true });
});

// ── CATEGORIAS ────────────────────────────────────────────────────────────────

app.get('/api/categories', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY sort_order, created_at');
  res.json(rows);
});

app.post('/api/categories', auth, async (req, res) => {
  const { id, label, icon, fixed } = req.body;
  const { rows: ex } = await pool.query('SELECT COUNT(*) FROM categories');
  const { rows } = await pool.query(
    'INSERT INTO categories(id,label,icon,fixed,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET label=$2,icon=$3 RETURNING *',
    [id, label, icon||'ti-tool', fixed||false, parseInt(ex[0].count)]
  );
  res.json(rows[0]);
});

app.delete('/api/categories/:id', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT fixed FROM categories WHERE id=$1', [req.params.id]);
  if (rows.length && rows[0].fixed) return res.status(403).json({ message: 'Categoria padrão não pode ser removida' });
  await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── PROCEDIMENTOS ─────────────────────────────────────────────────────────────

app.get('/api/procedures', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM procedures ORDER BY created_at DESC');
  res.json(rows.map(fmtProc));
});

app.post('/api/procedures', auth, async (req, res) => {
  const { title, cat, status, favorite, steps, obs, client } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO procedures(title,cat,status,favorite,steps,obs,client_name,client_phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [title, cat||'geral', status||'pendente', favorite||false, JSON.stringify(steps||[]), obs||'', (client&&client.name)||'', (client&&client.phone)||'']
  );
  res.json(fmtProc(rows[0]));
});

app.put('/api/procedures/:id', auth, async (req, res) => {
  const { title, cat, status, favorite, steps, obs, client } = req.body;
  const { rows } = await pool.query(
    `UPDATE procedures SET title=COALESCE($1,title),cat=COALESCE($2,cat),status=COALESCE($3,status),
     favorite=COALESCE($4,favorite),steps=COALESCE($5,steps),obs=COALESCE($6,obs),
     client_name=COALESCE($7,client_name),client_phone=COALESCE($8,client_phone),updated_at=NOW() WHERE id=$9 RETURNING *`,
    [title,cat,status,favorite, steps!==undefined?JSON.stringify(steps):null, obs, client?client.name:null, client?client.phone:null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Não encontrado' });
  res.json(fmtProc(rows[0]));
});

app.delete('/api/procedures/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM procedures WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

function fmtProc(r) {
  return { id:r.id, title:r.title, cat:r.cat, status:r.status, favorite:r.favorite,
    steps:r.steps||[], obs:r.obs||'', client:{name:r.client_name||'',phone:r.client_phone||''},
    createdAt:r.created_at, updatedAt:r.updated_at };
}

// ── HISTÓRICO ─────────────────────────────────────────────────────────────────

app.get('/api/history', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM history ORDER BY ts DESC LIMIT 30');
  res.json(rows.map(r => ({ procId:r.proc_id, title:r.title, cat:r.cat, userId:r.user_id, timestamp:parseInt(r.ts) })));
});

app.post('/api/history', auth, async (req, res) => {
  const { procId, title, cat } = req.body;
  await pool.query('DELETE FROM history WHERE proc_id=$1', [procId]);
  await pool.query('INSERT INTO history(proc_id,title,cat,user_id,ts) VALUES($1,$2,$3,$4,$5)', [procId,title,cat,req.user.id,Date.now()]);
  await pool.query('DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY ts DESC LIMIT 30)');
  res.json({ ok: true });
});

app.delete('/api/history', auth, async (req, res) => {
  await pool.query('DELETE FROM history');
  res.json({ ok: true });
});

// ── ALERTAS ───────────────────────────────────────────────────────────────────

app.get('/api/alerts', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM alerts ORDER BY created_at DESC');
  res.json(rows.map(r => ({ id:r.id, text:r.text, authorId:r.author_id, authorName:r.author_name, date:r.date, done:r.done })));
});

app.post('/api/alerts', auth, async (req, res) => {
  const { id, text, authorId, authorName, date, done } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO alerts(id,text,author_id,author_name,date,done) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    [id,text,authorId||null,authorName||'',date||new Date().toISOString().slice(0,10),done||false]
  );
  res.json(rows[0]);
});

app.put('/api/alerts/:id', auth, async (req, res) => {
  await pool.query('UPDATE alerts SET done=$1 WHERE id=$2', [req.body.done, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/alerts/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM alerts WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── NOTAS ─────────────────────────────────────────────────────────────────────

app.get('/api/notes', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notes WHERE user_id=$1 ORDER BY updated_at DESC', [req.user.id]);
  res.json(rows.map(fmtNote));
});

app.post('/api/notes', auth, async (req, res) => {
  const { id, title, blocks } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO notes(id,user_id,title,blocks) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET title=$3,blocks=$4,updated_at=NOW() RETURNING *',
    [id, req.user.id, title||'Sem título', JSON.stringify(blocks||[])]
  );
  res.json(fmtNote(rows[0]));
});

app.put('/api/notes/:id', auth, async (req, res) => {
  const { title, blocks } = req.body;
  const { rows } = await pool.query(
    'UPDATE notes SET title=COALESCE($1,title),blocks=COALESCE($2,blocks),updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING *',
    [title, blocks!==undefined?JSON.stringify(blocks):null, req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Nota não encontrada' });
  res.json(fmtNote(rows[0]));
});

app.delete('/api/notes/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM notes WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

function fmtNote(r) {
  return { id:r.id, userId:r.user_id, title:r.title, blocks:r.blocks||[], updatedAt:r.updated_at, createdAt:r.created_at };
}

// ── FALLBACK ──────────────────────────────────────────────────────────────────

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, req.path === '/' ? 'login.html' : req.path), err => {
    if (err) res.status(404).send('Não encontrado');
  });
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT}`));
}).catch(e => { console.error(e); process.exit(1); });
