// src/persistence.rs
// Simple SQLite persistence layer for HumanBrainEngine
// Uses rusqlite with bundled feature for static linking on Windows.

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredInsight {
    pub category: String,
    pub phrase: String,
    pub context: String,
    pub human_nuance: String,
    pub frequency_count: u32,
    pub last_updated: u64,
    pub rl_reward_score: f32,
    pub embedding_vector: Vec<f32>,
}

pub fn init_db<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS knowledge (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            phrase TEXT NOT NULL,
            context TEXT,
            human_nuance TEXT,
            frequency_count INTEGER,
            last_updated INTEGER,
            rl_reward_score REAL,
            embedding BLOB
        )",
        [],
    )?;
    Ok(conn)
}

fn serialize_vector(v: &[f32]) -> Result<Vec<u8>> {
    // Convert Vec<f32> to bytes (little endian)
    let mut bytes = Vec::with_capacity(v.len() * 4);
    for f in v {
        bytes.extend(&f.to_le_bytes());
    }
    Ok(bytes)
}

fn deserialize_vector(blob: &[u8]) -> Result<Vec<f32>> {
    if blob.len() % 4 != 0 {
        return Err(rusqlite::Error::InvalidColumnType(0, "invalid vector blob".into()));
    }
    let mut vec = Vec::with_capacity(blob.len() / 4);
    for chunk in blob.chunks_exact(4) {
        let arr: [u8; 4] = chunk.try_into().unwrap();
        vec.push(f32::from_le_bytes(arr));
    }
    Ok(vec)
}

pub fn save_insight(conn: &Connection, insight: &StoredInsight) -> Result<()> {
    let embedding_blob = serialize_vector(&insight.embedding_vector)?;
    conn.execute(
        "INSERT INTO knowledge (category, phrase, context, human_nuance, frequency_count, last_updated, rl_reward_score, embedding)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            insight.category,
            insight.phrase,
            insight.context,
            insight.human_nuance,
            insight.frequency_count as i64,
            insight.last_updated as i64,
            insight.rl_reward_score,
            embedding_blob,
        ],
    )?;
    Ok(())
}

pub fn load_all(conn: &Connection) -> Result<Vec<StoredInsight>> {
    let mut stmt = conn.prepare("SELECT category, phrase, context, human_nuance, frequency_count, last_updated, rl_reward_score, embedding FROM knowledge")?;
    let rows = stmt.query_map([], |row| {
        let blob: Vec<u8> = row.get(7)?;
        Ok(StoredInsight {
            category: row.get(0)?,
            phrase: row.get(1)?,
            context: row.get(2)?,
            human_nuance: row.get(3)?,
            frequency_count: row.get::<_, i64>(4)? as u32,
            last_updated: row.get::<_, i64>(5)? as u64,
            rl_reward_score: row.get(6)?,
            embedding_vector: deserialize_vector(&blob).unwrap_or_default(),
        })
    })?;
    let mut insights = Vec::new();
    for i in rows {
        insights.push(i?);
    }
    Ok(insights)
}
