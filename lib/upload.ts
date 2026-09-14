/**
 * 客户端 COS 直传工具
 *
 * 流程：向 /api/upload/presign 请求预签名 URL → 直接 PUT 文件到 COS → 返回对象 key。
 * 图片字节不经服务器，省带宽且安全。
 */

/** 生成一个唯一的 COS 对象 key */
export function makeKey(dir: string, file: File): string {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `${dir.replace(/^\/+|\/+$/g, '')}/${stamp}-${rand}.${ext}`
}

/** 上传单个文件到 COS，返回对象 key（相对 bucket 根目录的路径） */
export async function uploadToCos(file: File, dir: string): Promise<string> {
  const key = makeKey(dir, file)
  const res = await fetch(
    `/api/upload/presign?path=${encodeURIComponent(key)}`
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? '获取上传地址失败')
  }
  const { url } = await res.json()

  // 浏览器直接 PUT 到 COS 域名 —— 需要 Bucket 配置 CORS 允许跨域。
  // 若 COS 未配置 CORS，fetch 会抛 TypeError("Failed to fetch")，而非返回错误码。
  let put: Response
  try {
    put = await fetch(url, { method: 'PUT', body: file })
  } catch {
    throw new Error(
      '上传到 COS 失败（网络错误）。请确认 COS Bucket 已配置 CORS 跨域规则，允许当前来源（如 http://localhost:3000）的 PUT 请求。'
    )
  }
  if (!put.ok) {
    const text = await put.text().catch(() => '')
    throw new Error(`上传到 COS 失败（${put.status}）${text ? `：${text.slice(0, 200)}` : ''}`)
  }

  return key
}
