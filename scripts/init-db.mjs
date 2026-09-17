/**
 * 数据库初始化脚本
 *
 * 用法：
 *   node --experimental-sqlite scripts/init-db.mjs          # 仅建表
 *   node --experimental-sqlite scripts/init-db.mjs --seed   # 建表 + 示例相册
 *
 * 注意：日常使用无需手动运行 —— 服务首次启动时 getDb() 会自动建表。
 *       此脚本用于部署前验证或快速重置。
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'flight-albums.db')

const dir = path.dirname(dbPath)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const seed = process.argv.includes('--seed')

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS albums (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  coverPath   TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'lens',
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
`)

// 迁移：旧库补充 category 列（默认归入摄影目录）
{
  const cols = db.prepare('PRAGMA table_info(albums)').all()
  if (!cols.some((c) => c.name === 'category')) {
    db.exec("ALTER TABLE albums ADD COLUMN category TEXT NOT NULL DEFAULT 'lens'")
  }
}

console.log(`✓ 数据库已初始化：${dbPath}`)

if (seed) {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM albums').get().c
  if (existing > 0) {
    console.log('  相册已存在，跳过种子数据。')
  } else {
    const ts = new Date().toISOString()
    const albums = [
      ['mountains', '山川', '山不会走向你，但你可以走向山。', 'lens/mountains/001.jpg', 0],
      ['street', '街拍', '城市切片，日常的诗意。', 'lens/street/001.jpg', 1],
      ['portrait', '人像', '光打在脸上的那一刻。', 'lens/portrait/001.jpg', 2],
    ]
    const stmt = db.prepare(
      'INSERT INTO albums (id, title, description, coverPath, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const a of albums) stmt.run(...a, ts, ts)
    console.log(`  ✓ 已插入 ${albums.length} 个示例相册（请通过后台上传真实封面与照片）。`)
  }
}

db.close()
