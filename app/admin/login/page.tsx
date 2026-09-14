'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 管理员登录页 —— 单密码登录，提交到 /api/auth/login，成功后跳转 /admin。
 */
export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/admin')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '登录失败')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-[1.6rem] font-normal text-ink">Flight Albums</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-3">
            管理后台
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 border border-line-soft bg-bg-soft p-6 shadow-card"
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">
              密码
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="border border-line bg-bg px-3 py-2 font-sans text-sm text-ink outline-none focus:border-accent"
            />
          </label>

          {error && (
            <p className="font-sans text-sm text-terracotta">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-accent px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="mt-6 text-center">
          <a
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline transition-colors hover:text-ink"
          >
            ← 返回首页
          </a>
        </p>
      </div>
    </div>
  )
}
