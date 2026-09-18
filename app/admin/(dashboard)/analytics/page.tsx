/**
 * 访问统计（管理员）—— PV / UV、每日趋势、Top 相册 / IP、最近访问明细
 *
 *   /admin/analytics?range=7|30|all（默认 30 天）
 *
 * 数据由公开页面 Server Component 中的 trackVisit() 采集（见 lib/trackVisit.ts），
 * 管理员自己的访问不计入；记录滚动保留 180 天。
 */
import Link from 'next/link'
import {
  getVisitStats,
  getTodayStats,
  getTopAlbums,
  getTopIps,
  getRecentVisits,
  listAlbums,
} from '@/lib/queries'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ range?: string }>
}

const RANGES = [
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
  { value: 0, label: '全部' },
] as const

/** 近 N 天日期序列（含今天），用于趋势图补零。手动格式化，不依赖 ICU（alpine 镜像 small-icu 下 toLocaleDateString 不可靠） */
function lastDays(n: number): string[] {
  const days: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const p = (v: number) => String(v).padStart(2, '0')
    days.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  }
  return days
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const { range: rangeParam } = await searchParams
  const range = RANGES.some((r) => r.value.toString() === rangeParam)
    ? Number(rangeParam)
    : 30

  const stats = getVisitStats(range)
  const today = getTodayStats()
  const topAlbums = getTopAlbums(range, 8)
  const topIps = getTopIps(range, 10)
  const recent = getRecentVisits(50)

  // 相册标题映射（相册可能已删除）
  const albums = listAlbums(undefined, true)
  const albumTitle = new Map(albums.map((a) => [a.id, a.title]))

  // 趋势序列：补零对齐到完整日期范围
  const dailyMap = new Map(stats.daily.map((d) => [d.day, d]))
  const days = range === 0 ? stats.daily.map((d) => d.day) : lastDays(range)
  const series = days.map((day) => ({
    day,
    pv: dailyMap.get(day)?.pv ?? 0,
    uv: dailyMap.get(day)?.uv ?? 0,
  }))
  const maxPv = Math.max(1, ...series.map((s) => s.pv))

  const cardClass = 'border border-line-soft bg-bg-soft p-5'
  const cardLabel = 'font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3'

  return (
    <>
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-[1.6rem] font-normal text-ink">访问统计</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/admin/analytics?range=${r.value}`}
              className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] no-underline transition-colors ${
                range === r.value
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line text-ink-3 hover:border-line hover:text-ink'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 概要卡片 */}
      <div className="mb-10 grid grid-cols-4 gap-4 max-[720px]:grid-cols-2">
        <div className={cardClass}>
          <span className={`block ${cardLabel}`}>今日 PV</span>
          <span className="mt-1 block font-serif text-[2rem] text-ink">{today.pv}</span>
        </div>
        <div className={cardClass}>
          <span className={`block ${cardLabel}`}>今日 UV</span>
          <span className="mt-1 block font-serif text-[2rem] text-ink">{today.uv}</span>
        </div>
        <div className={cardClass}>
          <span className={`block ${cardLabel}`}>
            {range === 0 ? '累计' : `${range} 天`} PV
          </span>
          <span className="mt-1 block font-serif text-[2rem] text-ink">{stats.pv}</span>
        </div>
        <div className={cardClass}>
          <span className={`block ${cardLabel}`}>
            {range === 0 ? '累计' : `${range} 天`} UV
          </span>
          <span className="mt-1 block font-serif text-[2rem] text-ink">{stats.uv}</span>
        </div>
      </div>

      {/* 每日趋势 */}
      <h2 className="mb-4 border-b border-dashed border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
        每日趋势（PV / UV）
      </h2>
      {stats.pv === 0 ? (
        <p className="my-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          还没有访问记录。
        </p>
      ) : (
        <div className="mb-10 mt-5 overflow-x-auto">
          <div className="flex min-w-[480px] items-end gap-[6px]">
            {series.map((s) => (
              <div
                key={s.day}
                className="group relative flex flex-1 flex-col items-center gap-1"
                title={`${s.day} · PV ${s.pv} · UV ${s.uv}`}
              >
                <div className="flex h-40 w-full items-end justify-center gap-[3px]">
                  <div
                    className="w-1/2 bg-accent transition-opacity group-hover:opacity-80"
                    style={{ height: `${Math.max(2, (s.pv / maxPv) * 100)}%` }}
                  />
                  <div
                    className="w-1/3 bg-sage transition-opacity group-hover:opacity-80"
                    style={{ height: `${Math.max(2, (s.uv / maxPv) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-ink-3 max-[900px]:hidden">
                  {s.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 bg-accent" /> PV
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 bg-sage" /> UV
            </span>
          </div>
        </div>
      )}

      {/* Top 相册 + Top IP */}
      <div className="mb-10 grid grid-cols-2 gap-8 max-[900px]:grid-cols-1">
        <section>
          <h2 className="mb-4 border-b border-dashed border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
            热门相册
          </h2>
          {topAlbums.length === 0 ? (
            <p className="py-6 font-mono text-[11px] text-ink-3">暂无数据</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-dashed divide-line-soft border-y border-dashed border-line p-0">
              {topAlbums.map((a, i) => {
                const title = albumTitle.get(a.albumId)
                return (
                  <li key={a.albumId} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate font-serif text-[14px] text-ink">
                      <span className="mr-2 font-mono text-[10px] text-ink-3">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {title ?? a.albumId}
                      {!title && (
                        <span className="ml-1.5 font-mono text-[10px] text-ink-3">
                          （已删）
                        </span>
                      )}
                    </span>
                    <span className="flex-none font-mono text-[11px] text-ink-3">
                      {a.pv} 次
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 border-b border-dashed border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
            访问来源 IP
          </h2>
          {topIps.length === 0 ? (
            <p className="py-6 font-mono text-[11px] text-ink-3">暂无数据</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-dashed divide-line-soft border-y border-dashed border-line p-0">
              {topIps.map((ip) => (
                <li
                  key={ip.ip}
                  className="flex items-baseline justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0 truncate font-mono text-[13px] text-ink">
                    {ip.ip}
                  </span>
                  <span className="flex-none font-mono text-[11px] text-ink-3">
                    {ip.pv} 次 · {fmtTime(ip.lastVisitAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 最近访问明细 */}
      <h2 className="mb-4 border-b border-dashed border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
        最近访问
      </h2>
      {recent.length === 0 ? (
        <p className="py-6 font-mono text-[11px] text-ink-3">暂无数据</p>
      ) : (
        <div className="divide-y divide-dashed divide-line-soft border-y border-dashed border-line">
          {recent.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 max-[720px]:flex-col"
            >
              <span className="flex-none font-mono text-[11px] text-ink-3">
                {fmtTime(v.createdAt)}
              </span>
              <span className="flex-none font-serif text-[13.5px] text-ink">{v.path}</span>
              <span className="flex-none font-mono text-[11px] text-ink-2">{v.ip}</span>
              {v.userAgent && (
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-3 max-[720px]:hidden">
                  {v.userAgent}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 mb-0 font-mono text-[10px] tracking-[0.06em] text-ink-3">
        记录滚动保留 180 天 · 管理员访问不计入 · IP 取自反向代理注入的 X-Real-IP
      </p>
    </>
  )
}
