/**
 * 数据库查询函数 —— 相册与照片的 CRUD
 *
 * 使用 node:sqlite 预编译语句。SQLite 列名用 camelCase，与 TS 类型字段一一对应，无需映射。
 */
import { getDb } from './db'
import { normalizeCategory } from './categories'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import type { Album, Photo, AlbumInput, PhotoInput, AlbumCategory } from './types'

const now = (): string => new Date().toISOString()

/**
 * node:sqlite 返回的行对象是 null 原型（Object.create(null)），
 * Next.js 把 Server Component 数据传给 Client Component 时会拒绝这类对象
 * （RSC 序列化只接受普通对象）。这里展开为普通对象。
 */
function toPlain<T>(row: unknown): T {
  return { ...(row as object) } as T
}

/* ============================================================
   相册密码（scrypt，格式 scrypt$salt$hash，不存明文）
   ============================================================ */

/** 明文密码 → scrypt 哈希串 */
export function hashAlbumPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

/** 校验明文密码是否匹配哈希串 */
export function verifyAlbumPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const calc = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return calc.length === expected.length && timingSafeEqual(calc, expected)
}

/**
 * 密码指纹：passwordHash 的 sha256 前 16 位 hex。
 * 写入解锁 token，改密码/清密码后指纹变化，旧解锁自动失效。
 */
export function albumPwFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16)
}

/* ============================================================
   相册
   ============================================================ */

/** 数据库原始行（albums 表） */
type AlbumRow = Omit<Album, 'hidden' | 'hasPassword'> & {
  hidden?: number
  passwordHash?: string | null
}

/** 数据库行 → Album（剥除 passwordHash，换算 hidden/hasPassword） */
function rowToAlbum(row: unknown): Album {
  const { passwordHash, hidden, ...rest } = row as AlbumRow
  return {
    ...rest,
    hidden: !!hidden,
    hasPassword: !!passwordHash,
  }
}

/**
 * 列出相册（可按目录过滤，按 sortOrder 升序）。
 * 默认过滤 hidden（访客视图）；管理后台传 includeHidden = true。
 */
export function listAlbums(
  category?: AlbumCategory,
  includeHidden = false
): Album[] {
  const db = getDb()
  const where = [
    category ? 'category = ?' : '',
    includeHidden ? '' : 'hidden = 0',
  ]
    .filter(Boolean)
    .join(' AND ')
  const sql = `SELECT * FROM albums${where ? ` WHERE ${where}` : ''} ORDER BY sortOrder ASC, createdAt ASC`
  const stmt = db.prepare(sql)
  const rows = category
    ? stmt.all(category)
    : stmt.all()
  return rows.map(rowToAlbum)
}

/** 取单个相册（不含密码哈希） */
export function getAlbum(id: string): Album | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM albums WHERE id = ?').get(id)
  return row ? rowToAlbum(row) : null
}

/** 取相册密码哈希（仅校验用，不外泄） */
export function getAlbumPasswordHash(id: string): string | null {
  const db = getDb()
  const row = db
    .prepare('SELECT passwordHash FROM albums WHERE id = ?')
    .get(id) as { passwordHash: string | null } | undefined
  return row?.passwordHash ?? null
}

/** 创建相册 */
export function createAlbum(input: AlbumInput): Album {
  const db = getDb()
  const ts = now()
  db.prepare(
    `INSERT INTO albums (id, title, description, coverPath, category, sortOrder, hidden, passwordHash, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.title,
    input.description ?? null,
    input.coverPath,
    normalizeCategory(input.category),
    input.sortOrder ?? 0,
    input.hidden ? 1 : 0,
    input.password ? hashAlbumPassword(input.password) : null,
    ts,
    ts
  )
  return getAlbum(input.id)!
}

/** 更新相册（部分字段；password：字符串=设置，null=清除，undefined=不变） */
export function updateAlbum(
  id: string,
  input: Partial<Omit<AlbumInput, 'id'>>
): Album | null {
  const existing = getAlbum(id)
  if (!existing) return null
  const db = getDb()
  const merged = {
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    coverPath: input.coverPath ?? existing.coverPath,
    category: input.category ?? existing.category,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    hidden: input.hidden ?? existing.hidden,
    passwordHash:
      input.password === undefined
        ? (getAlbumPasswordHash(id) ?? null)
        : input.password === null
          ? null
          : hashAlbumPassword(input.password),
  }
  db.prepare(
    `UPDATE albums SET title = ?, description = ?, coverPath = ?, category = ?, sortOrder = ?, hidden = ?, passwordHash = ?, updatedAt = ?
     WHERE id = ?`
  ).run(
    merged.title,
    merged.description,
    merged.coverPath,
    merged.category,
    merged.sortOrder,
    merged.hidden ? 1 : 0,
    merged.passwordHash,
    now(),
    id
  )
  return getAlbum(id)
}

/** 删除相册（级联删除其下照片记录，但 COS 文件需另行清理） */
export function deleteAlbum(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM albums WHERE id = ?').run(id)
  return result.changes > 0
}

/** 取相册下的照片路径列表（删相册前用于清理 COS） */
export function getAlbumPhotoPaths(id: string): string[] {
  const db = getDb()
  return (
    db
      .prepare('SELECT path FROM photos WHERE albumId = ?')
      .all(id) as { path: string }[]
  ).map((r) => r.path)
}

/* ============================================================
   照片
   ============================================================ */

/** 按相册列出照片（按 date 降序、sortOrder 升序） */
export function listPhotosByAlbum(albumId: string): Photo[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT * FROM photos WHERE albumId = ?
       ORDER BY date DESC, sortOrder ASC, createdAt DESC`
    )
    .all(albumId)
    .map((r) => toPlain<Photo>(r))
}

/** 列出全部照片（仪表盘 / 最近上传用） */
export function listAllPhotos(limit?: number): Photo[] {
  const db = getDb()
  const sql = limit
    ? 'SELECT * FROM photos ORDER BY createdAt DESC LIMIT ?'
    : 'SELECT * FROM photos ORDER BY createdAt DESC'
  const rows = limit ? db.prepare(sql).all(limit) : db.prepare(sql).all()
  return rows.map((r) => toPlain<Photo>(r))
}

/** 取单张照片 */
export function getPhoto(id: number): Photo | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id)
  return row ? toPlain<Photo>(row) : null
}

/** 创建照片记录 */
export function createPhoto(input: PhotoInput): Photo {
  const db = getDb()
  const ts = now()
  const result = db
    .prepare(
      `INSERT INTO photos (path, title, description, date, albumId, location, sortOrder, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.path,
      input.title,
      input.description ?? null,
      input.date ?? null,
      input.albumId,
      input.location ?? null,
      input.sortOrder ?? 0,
      ts
    )
  return getPhoto(Number(result.lastInsertRowid))!
}

/** 更新照片（部分字段） */
export function updatePhoto(id: number, input: Partial<Omit<PhotoInput, 'path'>>): Photo | null {
  const existing = getPhoto(id)
  if (!existing) return null
  const db = getDb()
  const merged = {
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    date: input.date ?? existing.date,
    albumId: input.albumId ?? existing.albumId,
    location: input.location ?? existing.location,
    sortOrder: input.sortOrder ?? existing.sortOrder,
  }
  db.prepare(
    `UPDATE photos SET title = ?, description = ?, date = ?, albumId = ?, location = ?, sortOrder = ?
     WHERE id = ?`
  ).run(merged.title, merged.description, merged.date, merged.albumId, merged.location, merged.sortOrder, id)
  return getPhoto(id)
}

/** 删除照片记录 */
export function deletePhoto(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM photos WHERE id = ?').run(id)
  return result.changes > 0
}

/* ============================================================
   统计（仪表盘用）
   ============================================================ */

export function getStats(): { albumCount: number; photoCount: number; recentPhotos: Photo[] } {
  const db = getDb()
  const albumCount = (db.prepare('SELECT COUNT(*) AS c FROM albums').get() as { c: number }).c
  const photoCount = (db.prepare('SELECT COUNT(*) AS c FROM photos').get() as { c: number }).c
  const recentPhotos = db
    .prepare('SELECT * FROM photos ORDER BY createdAt DESC LIMIT 8')
    .all()
    .map((r) => toPlain<Photo>(r))
  return { albumCount, photoCount, recentPhotos }
}
