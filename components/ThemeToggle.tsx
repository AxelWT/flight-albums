'use client'

/**
 * 深浅色切换按钮 —— 三态循环：亮色 → 暗色 → 跟随系统
 *
 * 主题通过 html.dark 类控制（与 tokens.css 的 html.dark 选择器配合），
 * 模式持久化到 localStorage('fa-theme')：'light' | 'dark' | 'system'（默认）。
 * 'system' 跟随系统 prefers-color-scheme，系统切换深浅色时实时响应。
 * 为避免首屏闪屏，<layout> 里有一段内联脚本在 React 挂载前就把类写好；
 * 本组件挂载后再与实际状态同步。
 */
import { useEffect, useRef, useState } from 'react'

type Mode = 'light' | 'dark' | 'system'

/** 点击循环顺序 */
const ORDER: Mode[] = ['light', 'dark', 'system']
/** 各模式显示文案 */
const LABEL: Record<Mode, string> = {
  light: '亮色',
  dark: '暗色',
  system: '跟随系统',
}

/** 按模式应用 html.dark（返回是否为暗色） */
function applyMode(mode: Mode): boolean {
  const dark =
    mode === 'dark' ||
    (mode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

/** 下一次点击将切换到的模式 */
function nextMode(mode: Mode): Mode {
  return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
}

export default function ThemeToggle({
  className = 'gate-link',
}: {
  className?: string
}) {
  const [mode, setMode] = useState<Mode>('system')
  const modeRef = useRef<Mode>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    let stored: string | null = null
    try {
      stored = localStorage.getItem('fa-theme')
    } catch {
      /* ignore */
    }
    const initial: Mode =
      stored === 'light' || stored === 'dark' ? stored : 'system'
    modeRef.current = initial
    setMode(initial)
    // 与内联脚本的判定同步（防篡改/异常态下纠正）
    applyMode(initial)

    // 跟随系统模式下，系统切换深浅色时实时响应
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (modeRef.current === 'system') applyMode('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const next = nextMode(modeRef.current)
    modeRef.current = next
    setMode(next)
    applyMode(next)
    try {
      localStorage.setItem('fa-theme', next)
    } catch {
      /* ignore */
    }
  }

  // 未挂载时给一个占位文字，避免 hydration 不匹配；
  // 文案显示点击后切换到的模式（与 ShadowStyleToggle 的"目标动作"习惯一致）
  const label = mounted ? LABEL[nextMode(mode)] : '暗色'

  return (
    <button type="button" className={className} aria-label="切换深浅色" onClick={toggle}>
      {label}
    </button>
  )
}
