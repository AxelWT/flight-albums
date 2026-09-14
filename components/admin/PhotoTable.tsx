'use client'

/**
 * 照片管理表格 —— 编辑元数据 / 设为封面 / 删除
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SignedImg from '@/components/SignedImg'
import type { Photo } from '@/lib/types'

interface Props {
  photos: Photo[]
  albumId: string
}

export default function PhotoTable({ photos, albumId }: Props) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Partial<Photo>>({})
  const [saving, setSaving] = useState(false)

  function startEdit(p: Photo) {
    setEditingId(p.id)
    setDraft({
      title: p.title,
      date: p.date ?? '',
      location: p.location ?? '',
      description: p.description ?? '',
    })
  }

  async function saveEdit(id: number) {
    setSaving(true)
    const res = await fetch(`/api/photos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: draft.title,
        date: draft.date || null,
        location: draft.location || null,
        description: draft.description || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingId(null)
      router.refresh()
    } else {
      alert('保存失败')
    }
  }

  async function setAsCover(path: string) {
    const res = await fetch(`/api/albums/${albumId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverPath: path }),
    })
    if (res.ok) {
      alert('已设为封面')
      router.refresh()
    } else {
      alert('设置失败')
    }
  }

  const fieldClass =
    'border border-line bg-bg px-2.5 py-1.5 font-sans text-[13px] text-ink outline-none focus:border-accent'

  if (!photos.length) {
    return (
      <p className="border border-dashed border-line py-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        这个相册还没有照片。
      </p>
    )
  }

  return (
    <div className="divide-y divide-dashed divide-line-soft border-y border-dashed border-line">
      {photos.map((p) => (
        <div key={p.id} className="flex gap-4 py-4">
          <SignedImg
            path={p.path}
            size="thumb"
            alt={p.title}
            className="h-16 w-24 flex-none object-cover border border-line-soft"
          />

          {editingId === p.id ? (
            <div className="grid flex-1 grid-cols-2 gap-2 max-[520px]:grid-cols-1">
              <input
                value={draft.title ?? ''}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="标题"
                className={fieldClass}
              />
              <input
                value={draft.date ?? ''}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                placeholder="日期"
                className={fieldClass}
              />
              <input
                value={draft.location ?? ''}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="地点"
                className={fieldClass}
              />
              <input
                value={draft.description ?? ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="说明"
                className={fieldClass}
              />
              <div className="col-span-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => saveEdit(p.id)}
                  disabled={saving}
                  className="bg-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving ? '保存中…' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 hover:text-ink"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-[15px] text-ink">{p.title}</p>
              <p className="font-mono text-[10px] text-ink-3">
                {p.date ?? '无日期'}
                {p.location ? ` · ${p.location}` : ''}
              </p>
              {p.description && (
                <p className="mt-1 truncate text-[13px] text-ink-2">
                  {p.description}
                </p>
              )}
            </div>
          )}

          {editingId !== p.id && (
            <div className="flex flex-none flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => startEdit(p)}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3 hover:text-ink"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => setAsCover(p.path)}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3 hover:text-ink"
              >
                设为封面
              </button>
              <DeletePhotoButton id={p.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** 删除照片（含 COS 文件） */
function DeletePhotoButton({ id }: { id: number }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handle() {
    if (!confirm('确定删除这张照片？COS 上的图片也会被删除。')) return
    setDeleting(true)
    const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) router.refresh()
    else alert('删除失败')
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={deleting}
      className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3 hover:text-terracotta disabled:opacity-50"
    >
      {deleting ? '删除中…' : '删除'}
    </button>
  )
}
