/**
 * 图床 CDN URL 生成器（私有读 Bucket —— 带签名）
 *
 * 所有 URL 用 SecretKey 生成带时效的 GET 签名，私有读 Bucket 也可访问。
 * SecretKey 仅在服务端使用，此模块只能在 Server Component / API Route 中调用，
 * 不能在 Client Component 中直接 import。
 *
 * 数据万象（CI）图片处理参数用斜杠格式（如 imageView2/2/w/480/format/webp/q/85），
 * 不参与 COS 签名，只拼到 URL query 部分。需要 Bucket 已开通数据万象。
 *
 * 三档尺寸：
 *   thumb  w=480   ~40KB   画廊缩略图网格
 *   large  w=1920  ~400KB  Lightbox 大图
 *   raw    原图    5MB     "下载原图"按钮
 *
 * 签名默认 1 小时有效。
 */
import { getSignedGetUrl } from './cos'

/**
 * 缩略图：画廊网格用，宽 480px WebP。
 * 仅在服务端调用（Server Component / API Route）。
 */
export function thumb(path: string, width = 480): string {
  return getSignedGetUrl(path, `imageView2/2/w/${width}/format/webp/q/85`)
}

/**
 * 大图：Lightbox 用，宽 1920px WebP。
 * 仅在服务端调用。
 */
export function large(path: string, width = 1920): string {
  return getSignedGetUrl(path, `imageView2/2/w/${width}/format/webp/q/90`)
}

/**
 * 原图：下载用，不带任何处理参数，只签名。
 * 仅在服务端调用。
 */
export function raw(path: string): string {
  return getSignedGetUrl(path)
}
