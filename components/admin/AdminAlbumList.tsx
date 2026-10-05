'use client'

/**
 * 管理页相册列表 —— 按分类分节的拖拽排序列表
 *
 * 原生 HTML5 拖拽（零依赖，桌面场景）：把手 ⠿ 按下整行可拖，目标行上/下半区
 * 显示插入指示线；落定后本地乐观重排 → PUT /api/albums/reorder →
 * router.refresh() 同步；失败回滚并提示。
 */
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Album } from '@/lib/types'
import DeleteButton from '@/components/admin/DeleteButton'

interface Props {
  /** 同一分类的相册（已按当前顺序） */
  albums: (Album & { count: number; coverUrl: string; categoryLabel: string })[]
}

export default function AdminAlbumList({ albums }: Props) {
  const router = useRouter()
  const [order, setOrder] = useState(albums.map((a) => a.id))
  const byId = new Map(albums.map((a) => [a.id, a]))
  const [dragId, setDragId] = useState<string | null>(null)
  const [overPosition, setOverPosition] = useState<{
    beforeId: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)

  /** 计算落点：目标行上/下半区 → 插到目标行之前/之后 */
  function computeInsertId(e: React.DragEvent, rowId: string): string {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-album-id="${rowId}"]`
    )
    if (!row) return rowId
    const rect = row.getBoundingClientRect()
    return e.clientY < rect.top + rect.height / 2 ? rowId : nextIdAfter(rowId)
  }

  /** 顺序中某 id 的下一个 id；已是最后一个则返回自身（插到末尾语义） */
  function nextIdAfter(id: string): string {
    const i = order.indexOf(id)
    return i >= 0 && i < order.length - 1 ? order[i + 1] : id
  }

  async function saveReorder(nextOrder: string[]) {
    if (saving) return
    const prev = order
    setOrder(nextOrder)
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/albums/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: albums[0].category, ids: nextOrder }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? '保存失败')
      }
      router.refresh()
    } catch (err) {
      setOrder(prev)
      setError(err instanceof Error ? err.message : '保存失败，已还原顺序')
    } finally {
      setSaving(false)
    }
  }

  /** 拖拽落定：从原位移除，插到计算出的落点之前 */
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const from = dragId
    const insertBefore = overPosition?.beforeId ?? null
    setDragId(null)
    setOverPosition(null)
    if (!from || !insertBefore) return
    if (from === insertBefore) return
    const next = order.filter((id) => id !== from)
    const insertAt = next.indexOf(insertBefore)
    next.splice(insertAt === -1 ? next.length : insertAt, 0, from)
    // 顺序无变化（相邻前后落回原位）则不请求
    if (next.join('|') === order.join('|')) return
    saveReorder(next)
  }

  return (
    <div
      ref={listRef}
      onDragOver={(e) => {
        if (!dragId) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={onDrop}
      onDragEnd={() => {
        setDragId(null)
        setOverPosition(null)
      }}
      className="relative mb-12 divide-y divide-dashed divide-line-soft border-y border-dashed border-line"
    >
      {order.map((id) => {
        const a = byId.get(id)
        if (!a) return null
        return (
          <div
            key={id}
            data-album-id={id}
            draggable={!!a && !saving}
            onDragStart={(e) => {
              setDragId(id)
              setError('')
              // 拖拽预览图设为整行（默认只显示把手区域）
              const row = e.currentTarget
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setDragImage(row, 20, row.offsetHeight / 2)
            }}
            onDragOver={(e) => {
              if (!dragId || dragId === id) return
              e.preventDefault()
              e.stopPropagation()
              const beforeId = computeInsertId(e, id)
              setOverPosition((prev) =>
                prev?.beforeId === beforeId ? prev : { beforeId }
              )
            }}
            className={`flex items-center gap-4 py-3.5 ${
              dragId === id ? 'opacity-40' : ''
            } ${overPosition?.beforeId === id ? 'border-t-2 border-t-accent' : 'border-t-2 border-t-transparent'}`}
            style={{ cursor: saving ? 'wait' : 'default' }}
          >
            <span
              aria-hidden="true"
              className="select-none px-0.5 font-mono text-[13px] leading-none text-ink-3"
              style={{ cursor: saving ? 'wait' : 'grab' }}
              title="拖拽排序"
            >
              ⠿
            </span>
            <img
              src={a.coverUrl}
              alt={a.title}
              className="h-12 w-20 flex-none object-cover border border-line-soft"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-[15px] text-ink">
                {a.title}
              </p>
              <p className="font-mono text-[10px] text-ink-3">
                {a.id} · {a.categoryLabel} · {a.count} 张
                {a.hasPassword && (
                  <span className="text-sunkissed"> · 密码</span>
                )}
                {a.hidden && <span className="text-terracotta"> · 隐藏</span>}
              </p>
            </div>
            <Link
              href={`/admin/photos/${a.id}`}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline hover:text-ink"
            >
              照片
            </Link>
            <Link
              href={`/admin/albums/${a.id}`}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline hover:text-ink"
            >
              编辑
            </Link>
            <DeleteButton apiPath={`/api/albums/${a.id}`} />
          </div>
        )
      })}

      {saving && (
        <p className="absolute -top-6 right-0 m-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
          保存中…
        </p>
      )}
      {error && (
        <p className="absolute -top-6 right-0 m-0 font-mono text-[10px] uppercase tracking-[0.08em] text-terracotta">
          {error}
        </p>
      )}
    </div>
  )
}
