/**
 * COS 文件管理页：iframe 内嵌腾讯云 COS Browser Web。
 *
 * URL 由服务端从 COS_BROWSER_URL 环境变量读取（不入客户端 bundle）。
 * 由于腾讯云 COS Browser 需要登录态，首次访问会要求扫码 / 登录腾讯云账号。
 *
 * iframe 用 fixed 定位 + 显式 calc 尺寸填满侧边栏右侧的整个视口，
 * 突破 DashboardLayout 的 max-width + padding 容器限制。
 */
export const dynamic = 'force-dynamic'

export default function CosBrowserPage() {
  const url = process.env.COS_BROWSER_URL

  if (!url) {
    return (
      <p className="border border-dashed border-line bg-bg-soft px-5 py-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        未配置 COS_BROWSER_URL
      </p>
    )
  }

  return (
    <iframe
      src={url}
      title="COS Browser"
      className="fixed top-0 left-56 max-[640px]:left-0 h-screen w-[calc(100vw-14rem)] max-[640px]:w-screen border-0 bg-bg-soft"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
    />
  )
}
