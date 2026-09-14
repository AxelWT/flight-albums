'use client'

/**
 * 首页 = 门厅，结构对齐 lefos.com：
 *   居中 wordmark → 下方一行大写「进入」 → 四角固定的小标签
 * 入场节奏：logo 0.5s、进入 1.5s、四角 2.9s，各自淡入 1 秒（见 gate.css）。
 */
import Link from 'next/link'
import GateDapple from './GateDapple'
import ThemeToggle from './ThemeToggle'

export default function GateHome() {
  return (
    <div className="gate">
      {/* 光与暗角 */}
      <div className="gate-shade" aria-hidden="true" />

      {/* 会缓慢晃动的树叶影子 */}
      <GateDapple />

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
        <a
          className="gate-link"
          href="https://github.com/axelwt"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <ThemeToggle />
      </div>

      <div className="gate-corner gate-corner--br">
        <Link href="/admin/login" className="gate-link">
          管理
        </Link>
      </div>
    </div>
  )
}
