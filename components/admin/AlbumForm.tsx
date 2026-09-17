'use client'

/**
 * 相册表单 —— 创建 / 编辑
 *
 * 创建时需填 id（slug）；封面通过文件选择直传 COS。
 * 提交后跳转回 /admin/albums。
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadToCos } from '@/lib/upload'
import SignedImg from '@/components/SignedImg'
import { NAV_CATEGORIES, CATEGORY_META, normalizeCategory } from '@/lib/categories'
import type { Album } from '@/lib/types'

interface Props {
  album?: Album
}

export default function AlbumForm({ album }: Props) {
  const router = useRouter()
  const isEdit = !!album

  const [id, setId] = useState(album?.id ?? '')
  const [title, setTitle] = useState(album?.title ?? '')
  const [description, setDescription] = useState(album?.description ?? '')
  const [coverPath, setCoverPath] = useState(album?.coverPath ?? '')
  const [category, setCategory] = useState(normalizeCategory(album?.category))
  const [sortOrder, setSortOrder] = useState(album?.sortOrder ?? 0)
  const [hidden, setHidden] = useState(album?.hidden ?? false)
  const [password, setPassword] = useState('')
  const [clearPassword, setClearPassword] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const key = await uploadToCos(file, `${category}/covers`)
      setCoverPath(key)
    } catch (err) {
      setError(err instanceof Error ? err.message : '封面上传失败')
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) return setError('请填写相册名')
    if (!coverPath) return setError('请上传封面图片')
    setSaving(true)

    const pw = password.trim()
    const passwordField = isEdit
      ? clearPassword
        ? null // 清除密码
        : pw || undefined // 留空 = 不变
      : pw || null // 创建：留空 = 不设密码

    const body = {
      id: id.trim(),
      title: title.trim(),
      description: description.trim() || null,
      coverPath,
      category,
      sortOrder,
      hidden,
      password: passwordField,
    }

    try {
      if (isEdit && album) {
        const res = await fetch(`/api/albums/${album.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: body.title,
            description: body.description,
            coverPath: body.coverPath,
            category: body.category,
            sortOrder: body.sortOrder,
            hidden: body.hidden,
            password: body.password,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error ?? '保存失败')
        }
      } else {
        if (!body.id) {
          setSaving(false)
          return setError('请填写相册 id')
        }
        const res = await fetch('/api/albums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error ?? '创建失败')
        }
      }
      router.push('/admin/albums')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSaving(false)
    }
  }

  const fieldClass =
    'border border-line bg-bg px-3 py-2 font-sans text-sm text-ink outline-none focus:border-accent'
  const labelClass =
    'font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {!isEdit && (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>相册 id（slug，英文/数字/连字符）</span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="mountains"
            className={fieldClass}
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>目录</span>
        <select
          value={category}
          onChange={(e) => setCategory(normalizeCategory(e.target.value))}
          className={fieldClass}
        >
          {NAV_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}目录
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>相册名</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="山川"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>简介（可选）</span>
        <textarea
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="山不会走向你，但你可以走向山。"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>排序（数字越小越靠前）</span>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => setHidden(e.target.checked)}
          className="h-4 w-4 accent-[var(--fs-accent)]"
        />
        <span className="font-sans text-sm text-ink">
          隐藏相册
          <span className="ml-1.5 font-mono text-[11px] text-ink-3">
            （访客不可见，登录管理员可见）
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>
          访问密码（可选，{isEdit && album?.hasPassword ? '已设置' : '访客需输入密码才能浏览'}）
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={clearPassword}
          placeholder={
            isEdit && album?.hasPassword
              ? '留空保持不变'
              : '不设密码则公开浏览'
          }
          className={`${fieldClass} disabled:opacity-50`}
        />
        {isEdit && album?.hasPassword && (
          <label className="mt-0.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={clearPassword}
              onChange={(e) => setClearPassword(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--fs-accent)]"
            />
            <span className="font-mono text-[11px] text-ink-3">清除密码</span>
          </label>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>封面图片</span>
        <div className="flex items-start gap-4">
          {coverPath ? (
            <SignedImg
              path={coverPath}
              size="thumb"
              alt="封面预览"
              className="h-24 w-40 object-cover border border-line-soft"
            />
          ) : (
            <div className="flex h-24 w-40 items-center justify-center border border-dashed border-line-soft bg-bg-soft font-mono text-[10px] text-ink-3">
              {uploading ? '上传中…' : '无封面'}
            </div>
          )}
          <label className="cursor-pointer self-center border border-line bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink transition-colors hover:bg-bg-soft">
            {uploading ? '上传中…' : '选择图片'}
            <input
              type="file"
              accept="image/*"
              onChange={onCoverChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-terracotta">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-accent px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? '保存中…' : isEdit ? '保存修改' : '创建相册'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/albums')}
          className="border border-line px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-ink-3 transition-colors hover:text-ink"
        >
          取消
        </button>
      </div>
    </form>
  )
}
