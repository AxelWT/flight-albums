/**
 * 全局中间件 —— 保护管理后台页面与管理 API
 *
 * 运行在 Edge runtime（jose 兼容）。验证 httpOnly cookie 中的 JWT。
 * - /admin/*（除登录页）：未登录 → 重定向到 /admin/login
 * - /api/* 的非 GET 请求 + /api/upload/*：未登录 → 401
 * - 公开 GET（/api/albums、/api/photos）和 /api/auth/* 放行
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_ADMIN = ['/admin/login']
const PUBLIC_API = ['/api/auth/login', '/api/auth/logout']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(COOKIE_NAME)?.value
  const ok = await verifyToken(token)

  // /admin 页面保护（除登录页）
  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN.includes(pathname)) {
    if (!ok) {
      const url = req.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // API 保护
  if (pathname.startsWith('/api')) {
    const isPublicApi = PUBLIC_API.includes(pathname)
    const isPublicGet = req.method === 'GET' && !pathname.startsWith('/api/upload')
    if (!isPublicApi && !isPublicGet && !ok) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
