import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { NAV_CATEGORIES, CATEGORY_META } from '@/lib/categories'

/**
 * 站点布局：极简导航 + 页脚，包裹 /lens、/about 等内页。
 * 门厅首页（/）不使用此布局，保持全屏沉浸感。
 */
const navLinkClass =
  'font-mono text-[13px] uppercase tracking-[0.08em] text-ink-3 transition-colors hover:text-ink'

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const year = new Date().getFullYear()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-dashed border-line">
        <div className="mx-auto flex max-w-[60rem] items-center justify-between px-6 py-4 max-[520px]:px-5">
          <Link
            href="/"
            className="font-serif text-lg font-normal tracking-[0.01em] text-ink no-underline"
          >
            Flight Albums
          </Link>
          <nav className="flex items-center gap-5 max-[520px]:gap-4">
            {NAV_CATEGORIES.map((c) => (
              <Link key={c} href={CATEGORY_META[c].path} className={navLinkClass}>
                {CATEGORY_META[c].label}
              </Link>
            ))}
            <Link href="/about" className={navLinkClass}>
              关于
            </Link>
            <Link href="/admin" className={navLinkClass}>
              管理
            </Link>
            <ThemeToggle className={navLinkClass} />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[60rem] flex-1 px-6 py-10 max-[520px]:px-5 max-[520px]:py-8">
        {children}
      </main>

      <footer className="border-t border-dashed border-line">
        <div className="mx-auto flex max-w-[60rem] items-baseline justify-between px-6 py-5 max-[520px]:flex-col max-[520px]:gap-1.5 max-[520px]:px-5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
            Flight Albums
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
            © {year} · Personal Photography
          </span>
        </div>
      </footer>
    </div>
  )
}
