'use client'

/**
 * 自定义下拉框 —— 替代原生 select（管理后台表单）
 *
 * 原生 select 弹出列表走系统渲染，无法套用设计令牌（暗色/纸感风格割裂）。
 * 本组件为 listbox 模式：触发按钮 + 绝对定位弹层，全部用设计令牌着色，
 * 深浅色主题自动跟随；支持分组头（optgroup 等价）、键盘导航
 * （↑↓ 移动、Home/End 首末、Enter/空格 选中、Esc 关闭）与点击外部关闭。
 *
 * 风格：零圆角、纸感底、mono 分组头、虚线分隔，与站点设计语言一致。
 */
import { useEffect, useId, useRef, useState } from 'react'

export interface DropdownOption {
  value: string
  label: string
  /** 分组标签：同组选项按首次出现顺序相邻排列，组头不可选（optgroup 等价） */
  group?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  /** 根容器宽度控制（默认 w-56） */
  className?: string
  /** 触发按钮附加样式（默认与表单 fieldClass 一致） */
  buttonClassName?: string
}

export default function Dropdown({
  value,
  onChange,
  options,
  className = 'w-56',
  buttonClassName = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value) ?? null

  // 点击组件外部关闭
  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  // 键盘高亮项滚动进可视区
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector(`[data-idx="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  function openList() {
    const i = options.findIndex((o) => o.value === value)
    setHighlight(i === -1 ? 0 : i)
    setOpen(true)
  }

  function select(option: DropdownOption) {
    setOpen(false)
    onChange(option.value)
    buttonRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!options.length) return
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) =>
          e.key === 'ArrowDown'
            ? (h + 1) % options.length
            : (h - 1 + options.length) % options.length
        )
      } else if (e.key === 'Home') {
        e.preventDefault()
        setHighlight(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setHighlight(options.length - 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const option = options[highlight]
        if (option) select(option)
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        setOpen(false)
      }
    } else if (
      e.key === 'ArrowDown' ||
      e.key === 'ArrowUp' ||
      e.key === 'Enter' ||
      e.key === ' '
    ) {
      e.preventDefault()
      openList()
    }
  }

  // 分组渲染：遍历选项，组标签变化时插入组头（不可选、不占 highlight 索引）
  const rendered: React.ReactNode[] = []
  let lastGroup: string | null = null
  options.forEach((o, i) => {
    const group = o.group ?? null
    if (group !== lastGroup) {
      if (group) {
        rendered.push(
          <div
            key={`group-${group}`}
            className="border-b border-dashed border-line-soft px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3"
          >
            {group}
          </div>
        )
      }
      lastGroup = group
    }
    const isSelected = o.value === value
    const isHighlighted = i === highlight
    rendered.push(
      <div
        key={o.value}
        role="option"
        aria-selected={isSelected}
        data-idx={i}
        onClick={() => select(o)}
        onMouseEnter={() => setHighlight(i)}
        className={`flex cursor-pointer items-center gap-2 px-3 py-2 font-sans text-sm ${
          isHighlighted ? 'bg-bg-soft' : ''
        } ${isSelected ? 'text-ink' : 'text-ink-2'}`}
      >
        {/* 选中标记列：✓ / 空，固定宽度防抖动 */}
        <span
          aria-hidden="true"
          className={`w-3.5 flex-none text-center font-mono text-[11px] ${
            isSelected ? 'text-ink' : 'text-transparent'
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1 truncate">{o.label}</span>
      </div>
    )
  })

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 border border-line bg-bg px-3 py-2 text-left font-sans text-sm text-ink outline-none transition-colors hover:border-line focus:border-accent ${buttonClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.label : '—'}
        </span>
        <span
          aria-hidden="true"
          className={`flex-none font-mono text-[11px] text-ink-3 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>

      {open && options.length > 0 && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          // 阻止弹层内 mousedown 抢焦点（保持按钮聚焦，键盘导航不断）
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto border border-line bg-bg shadow-card"
        >
          {rendered}
        </div>
      )}
    </div>
  )
}
