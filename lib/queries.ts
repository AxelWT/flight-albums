/**
 * 数据库查询函数 —— 相册与照片的 CRUD
 *
 * 使用 node:sqlite 预编译语句。SQLite 列名用 camelCase，与 TS 类型字段一一对应，无需映射。
 */
import { getDb } from './db'
import type { Album, Photo, AlbumInput, PhotoInput } from './types'

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
   相册
   ============================================================ */

/** 列出全部相册（按 sortOrder 升序） */
export function listAlbums(): Album[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM albums ORDER BY sortOrder ASC, createdAt ASC')
    .all()
    .map((r) => toPlain<Album>(r))
}

/** 取单个相册 */
export function getAlbum(id: string): Album | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM albums WHERE id = ?').get(id)
  return row ? toPlain<Album>(row) : null
}

/** 创建相册 */
export function createAlbum(input: AlbumInput): Album {
  const db = getDb()
  const ts = now()
  db.prepare(
    `INSERT INTO albums (id, title, description, coverPath, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.title,
    input.description ?? null,
    input.coverPath,
    input.sortOrder ?? 0,
    ts,
    ts
  )
  return getAlbum(input.id)!
}

/** 更新相册（部分字段） */
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
    sortOrder: input.sortOrder ?? existing.sortOrder,
  }
  db.prepare(
    `UPDATE albums SET title = ?, description = ?, coverPath = ?, sortOrder = ?, updatedAt = ?
     WHERE id = ?`
  ).run(merged.title, merged.description, merged.coverPath, merged.sortOrder, now(), id)
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
