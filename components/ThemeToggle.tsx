'use client'

/**
 * 深浅色切换按钮
 *
 * 主题通过 html.dark 类控制（与 tokens.css 的 html.dark 选择器配合），
 * 选择持久化到 localStorage('fa-theme')。为避免首屏闪屏，<layout> 里有一段
 * 内联脚本在 React 挂载前就把类写好；本组件挂载后再与实际状态同步。
 */
import { useEffect, useState } from 'react'

export default function ThemeToggle({ className = 'gate-link' }: { className?: string }) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('fa-theme', next ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }

  // 未挂载时给一个占位文字，避免 hydration 不匹配
  const label = mounted ? (isDark ? '亮色' : '暗色') : '暗色'

  return (
    <button type="button" className={className} aria-label="切换深浅色" onClick={toggle}>
      {label}
    </button>
  )
}
