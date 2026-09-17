'use client'

/**
 * 相册密码锁 —— 密码相册的访客解锁表单
 *
 *   <AlbumLock albumId={album.id} />
 *
 * POST /api/albums/[id]/unlock 校验密码，成功后 refresh 由服务端渲染照片。
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AlbumLock({ albumId }: { albumId: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim() || checking) return
    setChecking(true)
    setError('')
    try {
      const res = await fetch(`/api/albums/${albumId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.refresh()
        return
      }
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? '解锁失败')
    } catch {
      setError('解锁失败')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="my-16 flex justify-center font-serif text-ink">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm border border-line-soft bg-bg-soft px-8 py-10 text-center shadow-card"
      >
        <p className="m-0 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
          Private Album
        </p>
        <p className="mt-3 mb-0 text-[15px] leading-[1.7] text-ink-2">
          这个相册设置了密码，输入密码后继续浏览。
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="相册密码"
          autoFocus
          className="mt-6 w-full border border-line bg-bg px-3 py-2.5 text-center text-sm text-ink outline-none focus:border-accent"
        />
        {error && <p className="mt-3 mb-0 text-[13px] text-terracotta">{error}</p>}
        <button
          type="submit"
          disabled={checking || !password.trim()}
          className="mt-5 bg-accent px-6 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {checking ? '验证中…' : '解锁'}
        </button>
      </form>
    </div>
  )
}
