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
  // 服务端顺序（成员或顺序变化时渲染期同步到 order：router.refresh 保留
  // 客户端 state，新建/删除相册后若不同步，列表会缺失/残留条目）
  const serverOrder = albums.map((a) => a.id)
  const serverKey = serverOrder.join('|')
  const [order, setOrder] = useState(serverOrder)
  const [syncedKey, setSyncedKey] = useState(serverKey)
  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey)
    setOrder(serverOrder)
  }
  const byId = new Map(albums.map((a) => [a.id, a]))
  const [dragId, setDragId] = useState<string | null>(null)
  /** 落点锚点：插到某行之前；null = 追加到列表末尾 */
  const [overPosition, setOverPosition] = useState<{
    beforeId: string | null
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const lastId = order.length ? order[order.length - 1] : null

  /**
   * 计算落点锚点：目标行上/下半区 → 插到目标行之前/之后。
   * 目标行是最后一行且落在下半区 → null（追加到末尾）。
   */
  function computeInsertId(e: React.DragEvent, rowId: string): string | null {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-album-id="${rowId}"]`
    )
    if (!row) return rowId
    const rect = row.getBoundingClientRect()
    if (e.clientY < rect.top + rect.height / 2) return rowId
    const i = order.indexOf(rowId)
    return i >= 0 && i < order.length - 1 ? order[i + 1] : null
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

  /** 拖拽落定：从原位移除，插到落点锚点之前（null 锚点 = 追加到末尾） */
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const from = dragId
    const target = overPosition
    setDragId(null)
    setOverPosition(null)
    if (!from || !target) return
    const insertBefore = target.beforeId
    if (from === insertBefore) return
    const next = order.filter((id) => id !== from)
    const insertAt =
      insertBefore === null
        ? next.length
        : next.indexOf(insertBefore) === -1
          ? next.length
          : next.indexOf(insertBefore)
    next.splice(insertAt, 0, from)
    // 顺序无变化（落回原位）则不请求
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
            className={`flex items-center gap-4 py-3.5 border-t-2 ${
              dragId === id ? 'opacity-40 ' : ''
            }${
              overPosition?.beforeId === id
                ? 'border-t-accent'
                : 'border-t-transparent'
            } ${
              // 末尾落点（beforeId=null）：最后一行显示底线指示
              overPosition?.beforeId === null && id === lastId
                ? 'border-b-2 border-b-accent'
                : ''
            }`}
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
