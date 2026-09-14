import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flight Albums',
  description: '个人摄影作品展示',
}

/**
 * 暗色模式初始化脚本：在 React 挂载前根据 localStorage 决定是否加 html.dark 类，
 * 避免首屏闪屏。默认浅色（纸感主题），仅当用户主动选择暗色时才切换。
 */
const themeScript = `try{if(localStorage.getItem('fa-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`

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
