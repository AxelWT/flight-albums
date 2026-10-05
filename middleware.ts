/**
 * 全局中间件 —— 保护管理后台页面与管理 API + 管理会话滑动续期
 *
 * 运行在 Edge runtime（jose 兼容）。验证 httpOnly cookie 中的 JWT。
 * - /admin/*（除登录页）：未登录 → 重定向到 /admin/login
 * - /api/* 的非 GET 请求 + /api/upload/*：未登录 → 401
 * - 公开 GET（/api/albums、/api/photos）、/api/auth/* 和 /api/image/sign 放行
 * - 滑动续期：token 有效且剩余有效期不足一半（< 1 小时）时，在响应上
 *   重签新 token 写回 cookie —— 活跃使用不过期，闲置 2 小时才需重新登录
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { JWTPayload } from 'jose'
import {
  verifyTokenClaims,
  signToken,
  COOKIE_NAME,
  TOKEN_TTL_SECONDS,
} from '@/lib/auth'

const PUBLIC_ADMIN = ['/admin/login']
const PUBLIC_API = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/image/sign', // 访客也要看 Lightbox 大图，签名接口公开（见 route 注释）
]
/** 相册解锁：POST 但需要对访客开放（动态段） */
const UNLOCK_API_RE = /^\/api\/albums\/[^/]+\/unlock$/

/**
 * 滑动续期：token 有效且剩余有效期 < TTL/2 时，重签新 token 写到响应 cookie。
 * 阈值判定避免每次请求都重签（签名 + Set-Cookie 开销）。
 */
async function withRenewal(
  res: NextResponse,
  claims: JWTPayload
): Promise<NextResponse> {
  const exp = typeof claims.exp === 'number' ? claims.exp : 0
  const remaining = exp - Math.floor(Date.now() / 1000)
  if (remaining > 0 && remaining * 2 < TOKEN_TTL_SECONDS) {
    res.cookies.set(COOKIE_NAME, await signToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: TOKEN_TTL_SECONDS,
    })
  }
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(COOKIE_NAME)?.value
  const claims = await verifyTokenClaims(token)
  const ok = claims !== null

  // /admin 页面保护（除登录页）
  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN.includes(pathname)) {
    if (!ok) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return withRenewal(NextResponse.next(), claims)
  }

  // API 保护
  if (pathname.startsWith('/api')) {
    const isPublicApi = PUBLIC_API.includes(pathname) || UNLOCK_API_RE.test(pathname)
    const isPublicGet = req.method === 'GET' && !pathname.startsWith('/api/upload')
    if (!isPublicApi && !isPublicGet && !ok) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    // 携带有效 token 的请求（含公开接口）都续期，管理活动不中断
    if (ok) return withRenewal(NextResponse.next(), claims)
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
