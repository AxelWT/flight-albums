'use client'

/**
 * 首页 = 门厅，结构对齐 lefos.com：
 *   居中 wordmark → 下方一行大写「进入」 → 四角固定的小标签
 * 入场节奏：logo 0.5s、进入 1.5s、四角 2.9s，各自淡入 1 秒（见 gate.css）。
 * 树影：可在「视频阴影」(LeafShadow, 新) 与「原版 SVG 枝影」(GateDapple)
 *       之间切换，并可整体关闭，均持久化到 localStorage。
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import LeafShadow from './LeafShadow'
import GateDapple from './GateDapple'
import ThemeToggle from './ThemeToggle'
import ShadowToggle from './ShadowToggle'
import ShadowStyleToggle from './ShadowStyleToggle'

const SHADOWS_KEY = 'fa-leaf-shadows'
const STYLE_KEY = 'fa-shadow-style'

export default function GateHome() {
  // 阴影开关与风格：默认开、默认视频影，均持久化到 localStorage
  const [shadowEnabled, setShadowEnabled] = useState(true)
  const [shadowStyle, setShadowStyle] = useState<'video' | 'dapple'>('video')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setShadowEnabled(localStorage.getItem(SHADOWS_KEY) !== 'off')
      const style = localStorage.getItem(STYLE_KEY)
      if (style === 'dapple' || style === 'video') setShadowStyle(style)
    } catch {
      /* ignore */
    }
  }, [])

  function toggleShadows() {
    const next = !shadowEnabled
    setShadowEnabled(next)
    try {
      localStorage.setItem(SHADOWS_KEY, next ? 'on' : 'off')
    } catch {
      /* ignore */
    }
  }

  function toggleShadowStyle() {
    const next = shadowStyle === 'video' ? 'dapple' : 'video'
    setShadowStyle(next)
    try {
      localStorage.setItem(STYLE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="gate">
      {/* 光与暗角 */}
      <div className="gate-shade" aria-hidden="true" />

      {/* 树影：视频影(新) 或 原版 SVG 枝影，可整体关闭 */}
      {mounted && shadowEnabled && shadowStyle === 'video' && (
        <LeafShadow shadowEnabled />
      )}
      {mounted && shadowEnabled && shadowStyle === 'dapple' && <GateDapple />}

      {/* 居中 wordmark */}
      <div className="gate-layer">
        <Link href="/" className="gate-logo" aria-label="Flight Albums">
          Flight Albums
        </Link>
      </div>

      {/* 居中后整体下移：和参考站同一个 clamp */}
      <div className="gate-layer gate-layer--enter">
        <Link href="/lens" className="gate-enter">
          进入
        </Link>
      </div>

      {/* 四角 */}
      <div className="gate-corner gate-corner--tr">
        <Link href="/about" className="gate-link">
          关于
        </Link>
      </div>

      <div className="gate-corner gate-corner--bl">
        <ShadowToggle enabled={shadowEnabled} onToggle={toggleShadows} />
        <ShadowStyleToggle style={shadowStyle} onToggle={toggleShadowStyle} />
      </div>

      <div className="gate-corner gate-corner--br">
        <Link href="/admin/login" className="gate-link">
          管理
        </Link>
        <ThemeToggle />
      </div>
    </div>
  )
}