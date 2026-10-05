/**
 * 认证工具：单管理员密码 + JWT（jose）
 *
 * 密码与 JWT 密钥均来自环境变量（GitHub Secret 注入），不入库。
 * 登录成功后签发 2 小时有效的 JWT，写入 httpOnly cookie；
 * middleware 在有效期过半时滑动续期（活跃使用不会过期，闲置 2 小时后需重新登录）。
 */
import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'

const COOKIE_NAME = 'fa_token'
/** 管理员 token 有效期：2 小时（middleware 滑动续期） */
const TOKEN_TTL = '2h'
/** TTL 秒数（cookie maxAge / 续期阈值换算用），与 TOKEN_TTL 保持一致 */
export const TOKEN_TTL_SECONDS = 2 * 60 * 60

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('缺少环境变量 JWT_SECRET')
  return new TextEncoder().encode(secret)
}

/** 签发管理员 JWT */
export async function signToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret())
}

/** 验证 JWT，合法返回 true */
export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  return (await verifyTokenClaims(token)) !== null
}

/** 验证 JWT 并返回 claims（含 exp，续期判定用）；无效/过期返回 null */
export async function verifyTokenClaims(
  token: string | undefined | null
): Promise<JWTPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload
  } catch {
    return null
  }
}

/** 校验管理员密码 */
export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  // 恒定时间比较，防计时攻击
  if (input.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < input.length; i++) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

/* ============================================================
   相册解锁 token（访客输入相册密码成功后签发）
   ============================================================ */

const UNLOCK_COOKIE_NAME = 'fa_unlocks'
const UNLOCK_TTL = '30d'

/** 解锁条目：id + 密码指纹（改密码后指纹不匹配，旧解锁自动失效） */
export interface UnlockEntry {
  id: string
  pw: string
}

/** 签发解锁 token（payload 为已解锁相册条目列表） */
export async function signUnlockToken(entries: UnlockEntry[]): Promise<string> {
  return new SignJWT({ albums: entries })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(UNLOCK_TTL)
    .sign(getSecret())
}

/** 解析解锁 token，返回条目列表（只做 JWT 校验，密码指纹由调用方比对；无效返回空数组） */
export async function verifyUnlockToken(
  token: string | undefined | null
): Promise<UnlockEntry[]> {
  if (!token) return []
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const albums = payload.albums
    if (!Array.isArray(albums)) return []
    return albums.filter(
      (e): e is UnlockEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as UnlockEntry).id === 'string' &&
        typeof (e as UnlockEntry).pw === 'string'
    )
  } catch {
    return []
  }
}

export { COOKIE_NAME, UNLOCK_COOKIE_NAME }
