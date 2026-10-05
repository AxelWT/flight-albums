import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flight Albums',
  description: '个人摄影作品展示',
}

/**
 * 暗色模式初始化脚本：在 React 挂载前写好 html.dark 类，避免首屏闪屏。
 * localStorage('fa-theme') 三态：'light' / 'dark' / 'system'（默认）——
 * 'system' 跟随系统 prefers-color-scheme。
 */
const themeScript = `try{var t=localStorage.getItem('fa-theme');if(t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
