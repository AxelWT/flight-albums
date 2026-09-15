'use client'

/**
 * 树影风格开关 —— 在「流影」(视频阴影, video) 与「疏影」(原版 SVG 枝影, dapple) 之间切换。
 * 状态由 GateHome 统一管理并持久化到 localStorage('fa-shadow-style')。
 * 文案显示点击后切换到的风格（与 ThemeToggle / ShadowToggle 的"目标动作"习惯一致）。
 */
export default function ShadowStyleToggle({
  style,
  onToggle,
  className = 'gate-link',
}: {
  style: 'video' | 'dapple'
  onToggle: () => void
  className?: string
}) {
  const label = style === 'video' ? '疏影' : '流影'
  return (
    <button
      type="button"
      className={className}
      aria-pressed={style === 'video'}
      aria-label="切换树影风格"
      onClick={onToggle}
    >
      {label}
    </button>
  )
}