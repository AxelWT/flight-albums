/**
 * 相册访问控制（仅服务端：Server Component / Route Handler）
 *
 * 规则：
 * - 隐藏相册：管理员可见，访客视为不存在（404）
 * - 密码相册：列表可见，管理员直接看；访客需通过 unlock 接口解锁（fa_unlocks cookie）
 */
import { cookies } from 'next/headers'
import {
  verifyToken,
  verifyUnlockToken,
  COOKIE_NAME,
  UNLOCK_COOKIE_NAME,
} from './auth'
import { getAlbum, getAlbumPasswordHash, albumPwFingerprint } from './queries'
import type { Album } from './types'

/** 当前请求是否为管理员（管理后台 JWT） */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return verifyToken(store.get(COOKIE_NAME)?.value)
}

/**
 * 当前访客仍有效的已解锁相册 id 列表。
 * 逐条与库中密码指纹比对：相册已删除、已无密码或密码已改 → 条目失效。
 */
export async function getUnlockedAlbumIds(): Promise<string[]> {
  const store = await cookies()
  const entries = await verifyUnlockToken(store.get(UNLOCK_COOKIE_NAME)?.value)
  const valid: string[] = []
  for (const e of entries) {
    const hash = getAlbumPasswordHash(e.id)
    if (hash && albumPwFingerprint(hash) === e.pw) valid.push(e.id)
  }
  return valid
}

export type AlbumAccess =
  | { status: 'not-found' }
  /** 访客访问隐藏相册 → 按 404 处理，不暴露存在性 */
  | { status: 'hidden' }
  /** 相册设了密码且访客未解锁 */
  | { status: 'locked'; album: Album }
  | { status: 'ok'; album: Album }

/** 综合判定某相册对当前访客的可见状态 */
export async function getAlbumAccess(albumId: string): Promise<AlbumAccess> {
  const album = getAlbum(albumId)
  if (!album) return { status: 'not-found' }

  const admin = await isAdmin()
  if (album.hidden && !admin) return { status: 'hidden' }

  if (album.hasPassword && !admin) {
    const unlocked = await getUnlockedAlbumIds()
    if (!unlocked.includes(albumId)) return { status: 'locked', album }
  }

  return { status: 'ok', album }
}
