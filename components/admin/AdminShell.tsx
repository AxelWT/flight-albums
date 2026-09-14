'use client'

/**
 * 管理后台外壳：左侧导航 + 退出登录 + 返回首页，包裹所有 /admin 仪表盘页面。
 */
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

const NAV = [
  { href: '/admin', label: '仪表盘', exact: true },
  { href: '/admin/albums', label: '相册' },
  { href: '/admin/photos/upload', label: '上传照片' },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function logout() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-dashed border-line bg-bg-soft max-[640px]:hidden">
        <div className="px-5 py-5">
          <Link
            href="/admin"
            className="font-serif text-lg font-normal tracking-[0.01em] text-ink no-underline"
          >
            Flight Albums
          </Link>
          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">
            Admin
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-l-2 px-3 py-2 font-sans text-sm no-underline transition-colors ${
                isActive(item.href, item.exact)
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-dashed border-line px-4 py-4">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline transition-colors hover:text-ink"
          >
            ← 返回首页
          </Link>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 transition-colors hover:text-terracotta disabled:opacity-50"
            >
              {loggingOut ? '退出中…' : '退出登录'}
            </button>
            <ThemeToggle className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 hover:text-ink" />
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 max-[640px]:ml-0 ml-56">
        <div className="mx-auto max-w-[56rem] px-8 py-10 max-[640px]:px-5 max-[640px]:py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
