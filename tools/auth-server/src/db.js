const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db = null;

function init(dbFile) {
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      // Enable foreign keys and WAL mode
      db.run('PRAGMA foreign_keys = ON', () => {
        db.run('PRAGMA journal_mode = WAL', () => {
          // Create users table if it doesn't exist
          db.run(`
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL UNIQUE COLLATE NOCASE,
              password_hash TEXT NOT NULL,
              name TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
          `, (err) => {
            if (err) {
              console.error('Error creating table:', err);
              reject(err);
            } else {
              resolve({
                async getUser(id) {
                  return new Promise((res, rej) => {
                    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
                      if (err) rej(err);
                      else res(row);
                    });
                  });
                },
                async getUserByUsername(username) {
                  return new Promise((res, rej) => {
                    db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username], (err, row) => {
                      if (err) rej(err);
                      else res(row);
                    });
                  });
                },
                async createUser(id, username, passwordHash, name) {
                  return new Promise((res, rej) => {
                    const now = new Date().toISOString();
                    db.run(
                      'INSERT INTO users (id, username, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                      [id, username, passwordHash, name, now, now],
                      function(err) {
                        if (err) rej(err);
                        else res({ id, username, name, created_at: now });
                      }
                    );
                  });
                },
                async deleteUser(id) {
                  return new Promise((res, rej) => {
                    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
                      if (err) rej(err);
                      else res(this.changes > 0);
                    });
                  });
                },
                async getAllUsers() {
                  return new Promise((res, rej) => {
                    db.all('SELECT * FROM users', (err, rows) => {
                      if (err) rej(err);
                      else res(rows || []);
                    });
                  });
                },
                close() {
                  return new Promise((res, rej) => {
                    db.close((err) => {
                      if (err) rej(err);
                      else res();
                    });
                  });
                }
              });
            }
          });
        });
      });
    });
  });
}

module.exports = { init };
