import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";
import type { Plan } from "../types";
let database: DatabaseSync | undefined;
export function db() {
  if (database) return database;
  const dir = path.resolve(
    process.env.DAVIO_DATA_DIR || path.join(process.cwd(), ".davio"),
  );
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  database = new DatabaseSync(path.join(dir, "davio.sqlite"));
  chmodSync(path.join(dir, "davio.sqlite"), 0o600);
  database.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),plan TEXT NOT NULL DEFAULT 'basic' CHECK(plan IN ('basic','pro')),created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,archived INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),revision INTEGER NOT NULL,data TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(project_id,revision));
  CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,kind TEXT NOT NULL,source_id TEXT REFERENCES files(id),bytes BLOB NOT NULL,created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS project_files(project_id TEXT NOT NULL REFERENCES projects(id),file_id TEXT NOT NULL REFERENCES files(id),position INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(project_id,file_id));
  CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,options TEXT NOT NULL,error TEXT,output_id TEXT REFERENCES files(id),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS usage(user_id TEXT NOT NULL REFERENCES users(id),month TEXT NOT NULL,kind TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,month,kind));
  CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,until INTEGER NOT NULL,count INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS chat(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),mode TEXT NOT NULL,project_id TEXT REFERENCES projects(id),question TEXT NOT NULL,answer TEXT NOT NULL,created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS runtime(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS project_owner ON projects(user_id,updated_at);
  CREATE INDEX IF NOT EXISTS file_owner ON files(user_id);
  CREATE INDEX IF NOT EXISTS chat_owner ON chat(user_id,created_at);
  CREATE INDEX IF NOT EXISTS queue_status ON jobs(status,created_at);`);
  // Additive migration: keep all original bytes and existing projects.
  database.exec("BEGIN IMMEDIATE");
  try {
    const columns = database.prepare("PRAGMA table_info(files)").all();
    if (!columns.some((c) => c.name === "settings"))
      database.exec(
        "ALTER TABLE files ADD COLUMN settings TEXT NOT NULL DEFAULT '{}'",
      );
    database.exec("COMMIT");
  } catch (e) {
    database.exec("ROLLBACK");
    throw e;
  }
  const defaults: Plan[] = [
    {
      id: "basic",
      label: "Базовый",
      projects: 20,
      storageMB: 256,
      renders: 20,
      texts: 100,
    },
    {
      id: "pro",
      label: "PRO",
      projects: 200,
      storageMB: 2048,
      renders: 100,
      texts: 1000,
    },
  ];
  for (const plan of defaults)
    database
      .prepare("INSERT OR IGNORE INTO plans VALUES (?,?)")
      .run(plan.id, JSON.stringify(plan));
  return database;
}
export function transaction<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    d.exec("COMMIT");
    return value;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
