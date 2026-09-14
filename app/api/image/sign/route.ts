import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { thumb, large, raw } from '@/lib/imageCdn'

/**
 * 签名 URL 生成 API —— 供 Client Component 获取带签名的图片 URL。
 *
 * 为什么需要这个 API：
 *   lib/imageCdn.ts 的 thumb/large/raw 是服务端函数（用 SecretKey 签名），
 *   Client Component 不能直接 import。需要签名 URL 时，前端调这个 API。
 *
 * 请求体：
 *   { items: [{ path, size }] }   size: 'thumb' | 'large' | 'raw'
 *
 * 响应：
 *   { urls: Record<path, url> }
 *
 * 公开访问（访客也要看 Lightbox 大图），不要求登录。
 */
const Body = z.object({
  items: z
    .array(
      z.object({
        path: z.string().min(1).max(500),
        size: z.enum(['thumb', 'large', 'raw']).default('thumb'),
      })
    )
    .max(200),
})

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  const urls: Record<string, string> = {}
  for (const item of parsed.data.items) {
    // 用 `path::size` 做 key，避免同一路径不同尺寸互相覆盖
    const key = `${item.path}::${item.size}`
    try {
      if (item.size === 'large') urls[key] = large(item.path)
      else if (item.size === 'raw') urls[key] = raw(item.path)
      else urls[key] = thumb(item.path)
    } catch {
      // 单个失败跳过，不影响其他
    }
  }

  // 缓存 1 小时：签名 URL 有效期 1 小时，浏览器/CDN 可缓存
  return NextResponse.json(
    { urls },
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  )
}
