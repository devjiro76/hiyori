/**
 * Shared SQLite database instance for Hiyori.
 * All tables are created here on first load.
 */
import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null
let initPromise: Promise<Database> | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  tool_results TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_facts (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relationship (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  score REAL DEFAULT 0,
  level TEXT DEFAULT 'stranger',
  total_messages INTEGER DEFAULT 0,
  first_interaction INTEGER,
  last_interaction INTEGER,
  streak_days INTEGER DEFAULT 0,
  last_streak_date TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS emotional_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  emotion TEXT DEFAULT 'calm',
  intensity REAL DEFAULT 0.3,
  valence REAL DEFAULT 0.0,
  arousal REAL DEFAULT 0.2,
  dominance REAL DEFAULT 0.0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  triggered_at INTEGER NOT NULL
);
`

export async function getDB(): Promise<Database> {
  if (db) return db
  if (initPromise) return initPromise

  initPromise = Database.load('sqlite:chat_history.db').then(async d => {
    const statements = SCHEMA.split(';').map(s => s.trim()).filter(Boolean)
    for (const stmt of statements) {
      await d.execute(stmt)
    }
    db = d
    return d
  })

  return initPromise
}
