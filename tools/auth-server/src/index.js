require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { init: initDb } = require('./db');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 4000;
const BIND_ADDR = process.env.BIND_ADDR || '127.0.0.1';
const JWT_SECRET = process.env.JWT_SECRET;
// DB_FILE can be set by systemd unit; recommended: /var/lib/mvs/auth.db
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'auth.db');
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '7d';
const AUTH_ALLOWED_ORIGIN = process.env.AUTH_ALLOWED_ORIGIN || null; // e.g. 'https://app.example.com'

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET must be set in environment');
  process.exit(1);
}

let db = null;
let dbReady = false;
const app = express();
// Configure CORS to allow only configured origin (if provided)
if (AUTH_ALLOWED_ORIGIN) {
  app.use(cors({ origin: AUTH_ALLOWED_ORIGIN }));
  console.log('CORS: allowing origin', AUTH_ALLOWED_ORIGIN);
} else {
  app.use(cors());
  console.log('CORS: allowing all origins (development)');
}
app.use(bodyParser.json());

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Middleware to check if DB is ready
function dbReady$ (req, res, next) {
  if (!dbReady) {
    return res.status(503).json({ ok: false, error: 'Database not ready' });
  }
  next();
}

app.use(dbReady$);

app.post('/api/register', async (req, res) => {
  try {
    const { username, passwordHash, name } = req.body || {};
    if (!username || !passwordHash) return res.status(400).json({ ok: false, error: 'username and passwordHash required' });
    
    const normalized = String(username).trim().toLowerCase();
    
    // Check if user already exists
    const existing = await db.getUserByUsername(normalized);
    if (existing) return res.status(400).json({ ok: false, error: 'User already exists' });
    
    // Hash password with argon2
    const passwordHashStored = await argon2.hash(String(passwordHash));
    
    const id = uuidv4();
    const user = await db.createUser(id, normalized, passwordHashStored, name || normalized);
    
    const token = signToken({ sub: id });
    return res.json({ ok: true, user: { id: user.id, username: user.username, name: user.name, createdAt: user.created_at }, token });
  } catch (e) {
    console.error('Register error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, passwordHash } = req.body || {};
    if (!username || !passwordHash) return res.status(400).json({ ok: false, error: 'username and passwordHash required' });
    
    const normalized = String(username).trim().toLowerCase();
    
    const row = await db.getUserByUsername(normalized);
    if (!row) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    
    const validPassword = await argon2.verify(row.password_hash, String(passwordHash));
    if (!validPassword) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    
    const user = { id: row.id, username: row.username, name: row.name, createdAt: row.created_at };
    const token = signToken({ sub: row.id });
    return res.json({ ok: true, user, token });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'missing_token' });
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload || !payload.sub) return res.status(401).json({ ok: false, error: 'invalid_token' });
  req.userId = payload.sub;
  next();
}

app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const row = await db.getUser(req.userId);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, user: { id: row.id, username: row.username, name: row.name, createdAt: row.created_at } });
  } catch (e) {
    console.error('Get me error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.delete('/api/me', authMiddleware, async (req, res) => {
  try {
    const deleted = await db.deleteUser(req.userId);
    if (!deleted) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true });
  } catch (e) {
    console.error('Delete me error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

async function initialize() {
  try {
    db = await initDb(DB_FILE);
    dbReady = true;
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    throw err;
  }
}

async function start() {
  try {
    await initialize();
    app.listen(PORT, BIND_ADDR, () => {
      console.log(`Auth server listening on http://${BIND_ADDR}:${PORT}`);
      console.log(`Database: ${DB_FILE}`);
      if (AUTH_ALLOWED_ORIGIN) console.log(`Allowed origin: ${AUTH_ALLOWED_ORIGIN}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, initialize };
