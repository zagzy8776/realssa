const fs = require('fs');
const path = require('path');

// Ensure directory backend/data exists for persistent local SQLite files
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  console.warn('⚠️ [SQLiteMultiEngine] sqlite3 package loading fallback');
}

const dbFiles = {
  articles: path.join(dataDir, 'articles.db'),
  intelligence: path.join(dataDir, 'intelligence.db'),
  analytics: path.join(dataDir, 'analytics.db'),
  queue: path.join(dataDir, 'queue.db')
};

const dbs = {};

function initDb(name, filePath) {
  if (!sqlite3) return null;
  const db = new sqlite3.Database(filePath, (err) => {
    if (err) {
      console.error(`❌ [SQLiteMultiEngine] Failed to connect to ${name}.db:`, err.message);
    } else {
      console.log(`✅ [SQLiteMultiEngine] Connected to isolated persistent SQLite DB: [${name}.db]`);
    }
  });

  // Enable WAL (Write-Ahead Logging) mode for fast concurrent reads & writes
  db.run('PRAGMA journal_mode = WAL;');
  return db;
}

if (sqlite3) {
  dbs.articles = initDb('articles', dbFiles.articles);
  dbs.intelligence = initDb('intelligence', dbFiles.intelligence);
  dbs.analytics = initDb('analytics', dbFiles.analytics);
  dbs.queue = initDb('queue', dbFiles.queue);

  // Initialize Tables across isolated DBs
  dbs.intelligence.serialize(() => {
    dbs.intelligence.run(`
      CREATE TABLE IF NOT EXISTS article_scores (
        article_id TEXT PRIMARY KEY,
        importance_score REAL DEFAULT 50.0,
        trend_score REAL DEFAULT 50.0,
        competition_score REAL DEFAULT 50.0,
        evergreen_score REAL DEFAULT 50.0,
        novelty_score REAL DEFAULT 50.0,
        promotion_score REAL DEFAULT 50.0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS article_entities (
        article_id TEXT,
        entity_name TEXT,
        entity_type TEXT,
        confidence REAL,
        PRIMARY KEY (article_id, entity_name)
      );

      CREATE TABLE IF NOT EXISTS article_predictions (
        article_id TEXT PRIMARY KEY,
        predicted_ctr REAL,
        predicted_rank INTEGER,
        health_score INTEGER,
        confidence_percent INTEGER,
        prompt_version TEXT,
        model_version TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  dbs.analytics.serialize(() => {
    dbs.analytics.run(`
      CREATE TABLE IF NOT EXISTS service_execution_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT NOT NULL,
        status TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        error_message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_budget_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        estimated_cost REAL DEFAULT 0.0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  dbs.queue.serialize(() => {
    dbs.queue.run(`
      CREATE TABLE IF NOT EXISTS job_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });
}

function runQuery(dbName, sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!dbs[dbName]) return resolve([]);
    dbs[dbName].all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function execute(dbName, sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!dbs[dbName]) return resolve({ changes: 0 });
    dbs[dbName].run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = {
  dbs,
  runQuery,
  execute
};
