/**
 * 访问采集（仅服务端：在公开页面的 Server Component 中调用）
 *
 *   await trackVisit('/lens')            // 页面
 *   await trackVisit('/lens/xxx', id)    // 相册详情
 *
 * - IP 提取（NPM/Nginx 反代场景）：优先 X-Real-IP（代理强制覆盖，不可伪造），
 *   兜底 X-Forwarded-For 最右端（代理追加的真实客户端；取左端可被伪造），
 *   都没有记 unknown（本地直连调试）
 * - 管理员（fa_token 登录态）访问不记录，统计更真实
 * - 全程容错：统计故障绝不影响页面渲染
 */
import { cookies, headers } from 'next/headers'
import { verifyToken, COOKIE_NAME } from './auth'
import { recordVisit } from './queries'

/** 从请求头提取客户端 IP */
function clientIp(h: Headers): string {
  const real = h.get('x-real-ip')
  if (real && isIp(real.trim())) return real.trim()
  // XFF: "client, proxy1, proxy2" —— 最右端是离本服务最近的代理见到的地址，
  // 即 NPM 追加的真实客户端 IP（左侧条目可被客户端伪造，不可信）
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const last = xff.split(',').pop()?.trim()
    if (last && isIp(last)) return last
  }
  return 'unknown'
}

function isIp(s: string): boolean {
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return true
  // IPv6（含 :: 缩写）
  return s.includes(':') && /^[0-9a-fA-F:.]+$/.test(s)
}

function truncate(s: string | null, max: number): string | null {
  if (!s) return null
  return s.length > max ? s.slice(0, max) : s
}

/** 记录一次页面访问（管理员访问忽略；失败静默） */
export async function trackVisit(path: string, albumId?: string | null): Promise<void> {
  try {
    const store = await cookies()
    if (await verifyToken(store.get(COOKIE_NAME)?.value)) return // 管理员不计数

    const h = await headers()
    recordVisit({
      path,
      albumId: albumId ?? null,
      ip: clientIp(h),
      userAgent: truncate(h.get('user-agent'), 300),
      referer: truncate(h.get('referer'), 500),
    })
  } catch {
    // 统计失败不影响页面
  }
}
