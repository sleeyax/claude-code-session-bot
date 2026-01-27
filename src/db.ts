import Database from "better-sqlite3";
import { DB_PATH } from "./config";
import type { Session, Schedule } from "./types";

let db: Database.Database;

export function initDb(path?: string): void {
  db = new Database(path ?? DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_datetime TEXT NOT NULL,
      hours_remaining REAL NOT NULL,
      warmup_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      fired INTEGER DEFAULT 0
    );
  `);
}

export function insertSession(
  sessionId: string,
  startedAt: string,
  expiresAt: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
  costUsd: number
): Session {
  const stmt = db.prepare(`
    INSERT INTO sessions (session_id, started_at, expires_at, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    sessionId,
    startedAt,
    expiresAt,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    costUsd
  );
  return db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(result.lastInsertRowid) as Session;
}

export function getActiveSession(): Session | undefined {
  return db
    .prepare("SELECT * FROM sessions WHERE expires_at > ? ORDER BY started_at DESC LIMIT 1")
    .get(new Date().toISOString()) as Session | undefined;
}

export function getSessionHistory(limit = 10): Session[] {
  return db
    .prepare("SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?")
    .all(limit) as Session[];
}

export function insertSchedule(
  targetDatetime: string,
  hoursRemaining: number,
  warmupAt: string
): Schedule {
  const stmt = db.prepare(`
    INSERT INTO schedules (target_datetime, hours_remaining, warmup_at, created_at, fired)
    VALUES (?, ?, ?, ?, 0)
  `);
  const result = stmt.run(targetDatetime, hoursRemaining, warmupAt, new Date().toISOString());
  return db
    .prepare("SELECT * FROM schedules WHERE id = ?")
    .get(result.lastInsertRowid) as Schedule;
}

export function getPendingSchedules(): Schedule[] {
  return db
    .prepare("SELECT * FROM schedules WHERE fired = 0 AND warmup_at > ? ORDER BY warmup_at ASC")
    .all(new Date().toISOString()) as Schedule[];
}

export function markScheduleFired(id: number): void {
  db.prepare("UPDATE schedules SET fired = 1 WHERE id = ?").run(id);
}

export function deleteSchedule(id: number): boolean {
  const result = db.prepare("DELETE FROM schedules WHERE id = ? AND fired = 0").run(id);
  return result.changes > 0;
}
