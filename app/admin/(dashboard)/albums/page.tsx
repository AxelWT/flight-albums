import Link from 'next/link'
import { listAlbums, listPhotosByAlbum } from '@/lib/queries'
import { thumb } from '@/lib/imageCdn'
import { CATEGORY_META, normalizeCategory } from '@/lib/categories'
import AlbumForm from '@/components/admin/AlbumForm'
import DeleteButton from '@/components/admin/DeleteButton'

export const dynamic = 'force-dynamic'

export default function AlbumsAdminPage() {
  const albums = listAlbums(undefined, true)

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="font-serif text-[1.6rem] font-normal text-ink">相册管理</h1>
        <Link
          href="/admin"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline hover:text-ink"
        >
          ← 仪表盘
        </Link>
      </div>

      {/* 相册列表 */}
      {albums.length === 0 ? (
        <p className="mb-10 border border-dashed border-line py-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          还没有相册，在下方新建。
        </p>
      ) : (
        <div className="mb-12 divide-y divide-dashed divide-line-soft border-y border-dashed border-line">
          {albums.map((a) => {
            const count = listPhotosByAlbum(a.id).length
            return (
              <div key={a.id} className="flex items-center gap-4 py-3.5">
                <img
                  src={thumb(a.coverPath, 120)}
                  alt={a.title}
                  className="h-12 w-20 flex-none object-cover border border-line-soft"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[15px] text-ink">{a.title}</p>
                  <p className="font-mono text-[10px] text-ink-3">
                    {a.id} · {CATEGORY_META[normalizeCategory(a.category)].label} · {count} 张 ·
                    排序 {a.sortOrder}
                    {a.hasPassword && <span className="text-sunkissed"> · 密码</span>}
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
        </div>
      )}

      {/* 新建相册 */}
      <section>
        <h2 className="mb-5 border-b border-dashed border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
          新建相册
        </h2>
        <div className="max-w-md">
          <AlbumForm />
        </div>
      </section>
    </>
  )
}
