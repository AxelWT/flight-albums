'use client'

/**
 * Shadows 阴影开关 —— 控制 LeafShadow 视频阴影的显示。
 * 状态由 GateHome 统一管理并持久化到 localStorage('fa-leaf-shadows')，默认 on。
 */
export default function ShadowToggle({
  enabled,
  onToggle,
  className = 'gate-link',
}: {
  enabled: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={className}
      aria-pressed={enabled}
      aria-label="切换树叶阴影"
      onClick={onToggle}
    >
      {enabled ? '关闭' : '开启'}
    </button>
  )
}