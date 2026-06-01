const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor() {
    this.db = null;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.API_KEYS_DB_PATH || './apiKeys.db';
      this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          console.error('Error connecting to the database:', err.message);
          reject(err);
        } else {
          console.log('Connected to the apiKeys.db database.');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    await this.run(`CREATE TABLE IF NOT EXISTS apiKeys (
      key TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tokens INTEGER DEFAULT 10,
      rate_limit INTEGER DEFAULT 10,
      active INTEGER DEFAULT 1,
      description TEXT
    )`);

    await this.run(`CREATE TABLE IF NOT EXISTS apiUsage (
      key TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await this.run(`CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL
    )`);

    await this.ensureColumns();
  }

  async ensureColumns() {
    const rows = await this.all("PRAGMA table_info(apiKeys)");
    const columns = rows.map(row => row.name);

    if (!columns.includes('active')) {
      await this.run("ALTER TABLE apiKeys ADD COLUMN active INTEGER DEFAULT 1");
      console.log("Added 'active' column to 'apiKeys' table.");
    }
    if (!columns.includes('description')) {
      await this.run("ALTER TABLE apiKeys ADD COLUMN description TEXT");
      console.log("Added 'description' column to 'apiKeys' table.");
    }
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      this.db.close((err) => {
        if (err) {
          console.error('Error closing the database connection:', err.message);
          reject(err);
        } else {
          console.log('Closed the database connection.');
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();
