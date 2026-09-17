import Link from 'next/link'
import { getStats, listAlbums } from '@/lib/queries'
import { thumb } from '@/lib/imageCdn'
import type { Photo } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const { albumCount, photoCount, recentPhotos } = getStats()
  const albums = listAlbums(undefined, true)
  const albumMap = new Map(albums.map((a) => [a.id, a.title]))

  return (
    <>
      <h1 className="mb-8 font-serif text-[1.6rem] font-normal text-ink">仪表盘</h1>

      {/* 统计卡片 */}
      <div className="mb-10 grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
        <div className="border border-line-soft bg-bg-soft p-5">
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
            相册数
          </span>
          <span className="mt-1 block font-serif text-[2rem] text-ink">{albumCount}</span>
        </div>
        <div className="border border-line-soft bg-bg-soft p-5">
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
            照片数
          </span>
          <span className="mt-1 block font-serif text-[2rem] text-ink">{photoCount}</span>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="mb-10 flex gap-3">
        <Link
          href="/admin/albums"
          className="border border-line bg-bg px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink no-underline transition-colors hover:bg-bg-soft"
        >
          管理相册
        </Link>
        <Link
          href="/admin/photos/upload"
          className="bg-accent px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink no-underline transition-colors hover:bg-accent-hover"
        >
          上传照片
        </Link>
      </div>

      {/* 最近上传 */}
      <section>
        <h2 className="mb-4 border-b border-dashed border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
          最近上传
        </h2>
        {recentPhotos.length === 0 ? (
          <p className="py-8 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            还没有照片。
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            {recentPhotos.map((p: Photo) => (
              <div key={p.id} className="overflow-hidden border border-line-soft bg-bg-soft">
                <img
                  src={thumb(p.path, 300)}
                  alt={p.title}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="border-t border-dashed border-line-soft px-2.5 py-2">
                  <p className="truncate text-[13px] text-ink">{p.title}</p>
                  <p className="font-mono text-[10px] text-ink-3">
                    {albumMap.get(p.albumId) ?? p.albumId}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
