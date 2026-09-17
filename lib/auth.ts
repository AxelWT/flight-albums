/**
 * 认证工具：单管理员密码 + JWT（jose）
 *
 * 密码与 JWT 密钥均来自环境变量（GitHub Secret 注入），不入库。
 * 登录成功后签发 7 天有效的 JWT，写入 httpOnly cookie。
 */
import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'fa_token'
const TOKEN_TTL = '7d'

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
  if (!token) return false
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
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

/** 签发解锁 token（payload 为已解锁相册 id 列表） */
export async function signUnlockToken(albumIds: string[]): Promise<string> {
  return new SignJWT({ albums: albumIds })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(UNLOCK_TTL)
    .sign(getSecret())
}

/** 校验解锁 token，返回已解锁相册 id 列表（无效返回空数组） */
export async function verifyUnlockToken(
  token: string | undefined | null
): Promise<string[]> {
  if (!token) return []
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const albums = payload.albums
    return Array.isArray(albums)
      ? albums.filter((a): a is string => typeof a === 'string')
      : []
  } catch {
    return []
  }
}

export { COOKIE_NAME, UNLOCK_COOKIE_NAME }
