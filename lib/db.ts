/**
 * SQLite 数据库连接（Node 内置 node:sqlite，无需额外依赖）
 *
 * 首次访问时自动建表。WAL 模式提升并发读写，外键约束开启（删除相册时级联删照片）。
 *
 * 注意：node:sqlite 在 Node 22 需 --experimental-sqlite 标志，Node 24+ 无需。
 *       本项目 engines 要求 Node >= 22，部署时通过 NODE_OPTIONS 兼容低版本。
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'

let dbInstance: DatabaseSync | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS albums (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  coverPath   TEXT NOT NULL,
  sortOrder   INTEGER NOT NULL DEFAULT 0,
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  date        TEXT,
  albumId     TEXT NOT NULL,
  location    TEXT,
  sortOrder   INTEGER NOT NULL DEFAULT 0,
  createdAt   TEXT NOT NULL,
  FOREIGN KEY (albumId) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_photos_album ON photos(albumId);
`

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance

  const dbPath = process.env.DB_PATH || './data/flight-albums.db'
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  dbInstance = new DatabaseSync(dbPath)
  dbInstance.exec('PRAGMA journal_mode = WAL')
  dbInstance.exec('PRAGMA foreign_keys = ON')
  dbInstance.exec(SCHEMA)

  return dbInstance
}

/** 关闭数据库连接（仅测试 / 优雅停机时用） */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
