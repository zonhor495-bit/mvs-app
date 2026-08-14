const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'auth.test.db');

// Setup env before loading app module
process.env.DB_FILE = dbPath;
process.env.JWT_SECRET = 'test_secret_key';

const { app, initialize } = require('./index');
const request = require('supertest');

beforeAll(async () => {
  // ensure clean DB
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {
      // ignore
    }
  }
  // also remove WAL files
  if (fs.existsSync(dbPath + '-wal')) {
    try {
      fs.unlinkSync(dbPath + '-wal');
    } catch (e) {
      // ignore
    }
  }
  if (fs.existsSync(dbPath + '-shm')) {
    try {
      fs.unlinkSync(dbPath + '-shm');
    } catch (e) {
      // ignore
    }
  }
});

afterAll(async () => {
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch (e) {
      // ignore
    }
  }
  if (fs.existsSync(dbPath + '-wal')) {
    try {
      fs.unlinkSync(dbPath + '-wal');
    } catch (e) {
      // ignore
    }
  }
  if (fs.existsSync(dbPath + '-shm')) {
    try {
      fs.unlinkSync(dbPath + '-shm');
    } catch (e) {
      // ignore
    }
  }
});

describe('auth server with SQLite', () => {
  let server;
  beforeAll(async () => {
    // Initialize database first
    await initialize();
    
    // Start server
    server = await new Promise((resolve) => {
      const srv = app.listen(0, () => {
        resolve(srv);
      });
    });
  });
  
  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  test('register -> login -> me -> delete', async () => {
    const username = 'testuser';
    const passwordHash = 'client_side_hash';

    // Register
    const reg = await request(server).post('/api/register').send({ username, passwordHash, name: 'Test User' });
    expect(reg.status).toBe(200);
    expect(reg.body.ok).toBe(true);
    expect(reg.body.user).toBeDefined();
    expect(reg.body.user.username).toBe(username);
    expect(reg.body.token).toBeDefined();
    const userId = reg.body.user.id;

    // Login with correct password
    const login = await request(server).post('/api/login').send({ username, passwordHash });
    expect(login.status).toBe(200);
    expect(login.body.ok).toBe(true);
    expect(login.body.token).toBeDefined();
    expect(login.body.user.id).toBe(userId);

    const token = login.body.token;

    // Get user profile
    const me = await request(server).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.ok).toBe(true);
    expect(me.body.user.username).toBe(username);
    expect(me.body.user.id).toBe(userId);

    // Try login with wrong password
    const badLogin = await request(server).post('/api/login').send({ username, passwordHash: 'wrong' });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.error).toBe('invalid_credentials');

    // Try register same username again (should fail)
    const reg2 = await request(server).post('/api/register').send({ username, passwordHash, name: 'Dup' });
    expect(reg2.status).toBe(400);
    expect(reg2.body.error).toBe('User already exists');

    // Delete account
    const del = await request(server).delete('/api/me').set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    // Try to get profile after deletion (should fail because user no longer exists)
    const me2 = await request(server).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(me2.status).toBe(404);
    expect(me2.body.error).toBe('not_found');
  });

  test('multiple users independent accounts', async () => {
    const user1 = { username: 'alice', passwordHash: 'pass1', name: 'Alice' };
    const user2 = { username: 'bob', passwordHash: 'pass2', name: 'Bob' };

    // Register both users
    const reg1 = await request(server).post('/api/register').send(user1);
    expect(reg1.status).toBe(200);
    expect(reg1.body.user.username).toBe('alice');

    const reg2 = await request(server).post('/api/register').send(user2);
    expect(reg2.status).toBe(200);
    expect(reg2.body.user.username).toBe('bob');

    // Both should be able to login
    const login1 = await request(server).post('/api/login').send({ username: 'alice', passwordHash: 'pass1' });
    expect(login1.status).toBe(200);

    const login2 = await request(server).post('/api/login').send({ username: 'bob', passwordHash: 'pass2' });
    expect(login2.status).toBe(200);

    // Cross-user password attempts should fail
    const wrongPass1 = await request(server).post('/api/login').send({ username: 'alice', passwordHash: 'pass2' });
    expect(wrongPass1.status).toBe(401);

    const wrongPass2 = await request(server).post('/api/login').send({ username: 'bob', passwordHash: 'pass1' });
    expect(wrongPass2.status).toBe(401);
  });
});
