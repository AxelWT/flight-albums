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
 *   thumb  240/400/640w q75  画廊缩略图瀑布流（响应式 srcset，见 thumbSrcset）
 *   large  w=1920  ~400KB  Lightbox 大图
 *   raw    原图    5MB     "下载原图"按钮
 *
 * 签名默认 1 小时有效。
 */
import { getSignedGetUrl } from './cos'

/**
 * 缩略图：单档宽度（封面、后台预览等）。
 * 质量从 q85 降至 q75（体积约省 30%，画廊场景无感），仅在服务端调用。
 */
export function thumb(path: string, width = 480): string {
  return getSignedGetUrl(path, `imageView2/2/w/${width}/format/webp/q/75`)
}

/** 缩略图 srcset 档位（与 PhotoGallery 的 sizes 配合：手机窄列 160px / 桌面列 ~320px） */
export const THUMB_WIDTHS = [240, 400, 640] as const

export interface ThumbSrcset {
  /** 兜底 src（不支持 srcset 的浏览器） */
  src: string
  /** "url 240w, url 400w, url 640w" */
  srcset: string
}

/**
 * 缩略图响应式 srcset：按设备宽度和 DPR 选档下载，省 COS 外网流量。
 * 仅在服务端调用。
 */
export function thumbSrcset(path: string): ThumbSrcset {
  const urls = THUMB_WIDTHS.map(
    (w) => getSignedGetUrl(path, `imageView2/2/w/${w}/format/webp/q/75`)
  )
  // 兜底 src 取中间档
  const fallback = urls[Math.floor(urls.length / 2)]
  return {
    src: fallback,
    srcset: urls.map((u, i) => `${u} ${THUMB_WIDTHS[i]}w`).join(', '),
  }
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
