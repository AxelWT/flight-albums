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
