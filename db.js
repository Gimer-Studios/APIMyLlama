const sqlite3 = require('sqlite3').verbose();

let db;

function initializeDatabase() {
  db = new sqlite3.Database('./apiKeys.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
    } else {
      console.log('Connected to the apiKeys.db database.');
      createTables();
    }
  });
  return db;
}

  // Function to create the tables even if they do not exist in the database
function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS apiKeys (
    key TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tokens INTEGER DEFAULT 10,
    rate_limit INTEGER DEFAULT 10,
    active INTEGER DEFAULT 1,
    description TEXT
  )`, (err) => {
    if (err) {
      console.error('Error creating apiKeys table:', err.message);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS apiUsage (
    key TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating apiUsage table:', err.message);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL
  )`, (err) => {
    if (err) {
      console.error('Error creating webhooks table:', err.message);
    }
  });

  ensureColumns();
}

function ensureColumns() {
  db.all("PRAGMA table_info(apiKeys)", (err, rows) => {
    if (err) {
      console.error('Error checking table info:', err.message);
    } else {
      const columns = rows.map(row => row.name);
      if (!columns.includes('active')) {
        db.run("ALTER TABLE apiKeys ADD COLUMN active INTEGER DEFAULT 1", (err) => {
          if (err) {
            console.error('Error adding active column:', err.message);
          } else {
            console.log("Added 'active' column to 'apiKeys' table.");
          }
        });
      }
      if (!columns.includes('description')) {
        db.run("ALTER TABLE apiKeys ADD COLUMN description TEXT", (err) => {
          if (err) {
            console.error('Error adding description column:', err.message);
          } else {
            console.log("Added 'description' column to 'apiKeys' table.");
          }
        });
      }
    }
  });
}

function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('Error closing the database connection:', err.message);
    } else {
      console.log('Closed the database connection.');
    }
    process.exit(0);
  });
}

function getDb() {
  return db;
}

module.exports = {
  initializeDatabase,
  closeDatabase,
  getDb
};