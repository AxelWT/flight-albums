'use client'

/**
 * 照片批量上传组件
 *
 * 流程：
 *   1. 选择目标相册
 *   2. 拖拽 / 选择多张图片 → 逐张直传 COS（拿到 path）
 *   3. 为每张填写元数据（标题默认取文件名，日期默认今天）
 *   4. 「保存全部」→ 逐条 POST /api/photos 写入数据库
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadToCos } from '@/lib/upload'
import { signedUrl } from '@/lib/clientImage'
import type { Album } from '@/lib/types'

interface PendingPhoto {
  key: string
  title: string
  date: string
  location: string
  description: string
  status: 'uploading' | 'ready' | 'saved' | 'error'
  error?: string
  thumbUrl?: string
}

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

export default function PhotoUploader({ albums }: { albums: Album[] }) {
  const router = useRouter()
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? '')
  const [items, setItems] = useState<PendingPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFiles(files: FileList | File[]) {
    if (!albumId) return alert('请先选择相册')
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!arr.length) return

    setUploading(true)
    for (const file of arr) {
      const placeholderKey = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const baseTitle = file.name.replace(/\.[^.]+$/, '')
      setItems((prev) => [
        ...prev,
        {
          key: placeholderKey,
          title: baseTitle,
          date: today(),
          location: '',
          description: '',
          status: 'uploading',
        },
      ])
      try {
        const key = await uploadToCos(file, `lens/${albumId}`)
        // 获取缩略图签名 URL 供预览显示
        const thumbUrl = await signedUrl(key, 'thumb')
        setItems((prev) =>
          prev.map((p) =>
            p.key === placeholderKey
              ? { ...p, key, status: 'ready', thumbUrl }
              : p
          )
        )
      } catch (err) {
        setItems((prev) =>
          prev.map((p) =>
            p.key === placeholderKey
              ? {
                  ...p,
                  status: 'error',
                  error: err instanceof Error ? err.message : '上传失败',
                }
              : p
          )
        )
      }
    }
    setUploading(false)
  }

  function updateItem(key: string, patch: Partial<PendingPhoto>) {
    setItems((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p))
    )
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((p) => p.key !== key))
  }

  async function saveAll() {
    const ready = items.filter((p) => p.status === 'ready')
    if (!ready.length) return
    if (!albumId) return alert('请先选择相册')
    setSaving(true)
    for (const p of ready) {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: p.key,
          title: p.title,
          description: p.description || null,
          date: p.date || null,
          albumId,
          location: p.location || null,
        }),
      })
      if (res.ok) {
        updateItem(p.key, { status: 'saved' })
      } else {
        updateItem(p.key, { status: 'error', error: '保存失败' })
      }
    }
    setSaving(false)
    router.refresh()
  }

  const fieldClass =
    'border border-line bg-bg px-2.5 py-1.5 font-sans text-[13px] text-ink outline-none focus:border-accent'

  if (!albums.length) {
    return (
      <p className="border border-dashed border-line py-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        请先创建一个相册。
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 相册选择 + 拖拽区 */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
            目标相册
          </span>
          <select
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            className="border border-line bg-bg px-3 py-2 font-sans text-sm text-ink outline-none focus:border-accent"
          >
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.id})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`flex h-40 items-center justify-center border-2 border-dashed transition-colors ${
          dragOver ? 'border-accent bg-bg-soft' : 'border-line-soft bg-bg'
        }`}
      >
        <label className="cursor-pointer text-center">
          <p className="font-serif text-[15px] text-ink">
            拖拽图片到此处，或点击选择
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
            支持多张 · JPG / PNG / WebP
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {/* 待保存列表 */}
      {items.length > 0 && (
        <div className="divide-y divide-dashed divide-line-soft border-y border-dashed border-line">
          {items.map((p) => (
            <div key={p.key} className="flex gap-4 py-4">
              <img
                src={p.thumbUrl ?? ''}
                alt=""
                className="h-16 w-24 flex-none object-cover border border-line-soft"
              />
              <div className="grid flex-1 grid-cols-2 gap-2 max-[520px]:grid-cols-1">
                <input
                  value={p.title}
                  onChange={(e) => updateItem(p.key, { title: e.target.value })}
                  placeholder="标题"
                  disabled={p.status === 'saved'}
                  className={fieldClass}
                />
                <input
                  value={p.date}
                  onChange={(e) => updateItem(p.key, { date: e.target.value })}
                  placeholder="日期 2026.09.14"
                  disabled={p.status === 'saved'}
                  className={fieldClass}
                />
                <input
                  value={p.location}
                  onChange={(e) => updateItem(p.key, { location: e.target.value })}
                  placeholder="拍摄地点"
                  disabled={p.status === 'saved'}
                  className={fieldClass}
                />
                <input
                  value={p.description}
                  onChange={(e) => updateItem(p.key, { description: e.target.value })}
                  placeholder="说明（可选）"
                  disabled={p.status === 'saved'}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
                    p.status === 'saved'
                      ? 'text-sage'
                      : p.status === 'error'
                        ? 'text-terracotta'
                        : p.status === 'uploading'
                          ? 'text-ink-3'
                          : 'text-ink-2'
                  }`}
                >
                  {p.status === 'uploading'
                    ? '上传中…'
                    : p.status === 'ready'
                      ? '待保存'
                      : p.status === 'saved'
                        ? '已保存'
                        : p.error ?? '错误'}
                </span>
                {p.status !== 'saved' && (
                  <button
                    type="button"
                    onClick={() => removeItem(p.key)}
                    className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3 hover:text-terracotta"
                  >
                    移除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 操作 */}
      {items.some((p) => p.status === 'ready') && (
        <button
          type="button"
          onClick={saveAll}
          disabled={saving || uploading}
          className="self-start bg-accent px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存全部到相册'}
        </button>
      )}
    </div>
  )
}
