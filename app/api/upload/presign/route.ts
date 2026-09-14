import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPresignedPutUrl } from '@/lib/cos'

const Query = z.object({
  path: z.string().min(1).max(500),
})

/**
 * 管理员：生成 COS 预签名 PUT URL。
 * 客户端拿到 URL 后直接 PUT 图片字节到 COS，不经服务器。
 * URL 10 分钟有效。
 */
export async function GET(req: NextRequest) {
  const pathParam = req.nextUrl.searchParams.get('path')
  const parsed = Query.safeParse({ path: pathParam })
  if (!parsed.success) {
    return NextResponse.json({ error: '缺少 path 参数' }, { status: 400 })
  }

  // 规范化路径：去掉开头的 /
  const key = parsed.data.path.replace(/^\/+/, '')
  // 简单校验：只允许图片扩展名，防止上传任意文件
  if (!/\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i.test(key)) {
    return NextResponse.json({ error: '仅支持图片文件' }, { status: 400 })
  }

  const url = getPresignedPutUrl(key, 600)
  return NextResponse.json({ url, path: key })
}
