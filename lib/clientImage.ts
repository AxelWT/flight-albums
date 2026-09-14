/**
 * 客户端获取 COS 签名 URL 的工具
 *
 * lib/imageCdn.ts 的 thumb/large/raw 是服务端函数（用 SecretKey 签名），
 * Client Component 不能直接 import。需要显示图片时，调 /api/image/sign 获取签名 URL。
 *
 * 带内存缓存，避免同一 path 重复请求。
 */

const cache = new Map<string, string>()

/**
 * 获取单张图片的签名 URL。
 * size: 'thumb' | 'large' | 'raw'
 */
export async function signedUrl(
  path: string,
  size: 'thumb' | 'large' | 'raw' = 'thumb'
): Promise<string> {
  const cacheKey = `${path}::${size}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const res = await fetch('/api/image/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ path, size }] }),
  })
  if (!res.ok) return ''
  const data = await res.json()
  const url = data.urls?.[cacheKey] ?? ''
  if (url) cache.set(cacheKey, url)
  return url
}
