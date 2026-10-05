import Link from 'next/link'
import { listAlbums, listPhotosByAlbum } from '@/lib/queries'
import { thumb } from '@/lib/imageCdn'
import { CATEGORY_META, NAV_CATEGORIES } from '@/lib/categories'
import AdminAlbumList from '@/components/admin/AdminAlbumList'
import AlbumForm from '@/components/admin/AlbumForm'

export const dynamic = 'force-dynamic'

export default function AlbumsAdminPage() {
  const albums = listAlbums(undefined, true)

  // 每个分类的元信息（照片数、封面签名 URL），供列表行展示
  const counts: Record<string, number> = {}
  for (const a of albums) {
    counts[a.id] = listPhotosByAlbum(a.id).length
  }

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

      {/* 按分类分节：典藏在前、拾光在后（与前台导航顺序一致）；
          各节内拖拽把手排序，编号互相独立 */}
      {NAV_CATEGORIES.map((category) => {
        const section = albums.filter((a) => a.category === category)
        return (
          <section key={category}>
            <h2 className="mb-4 border-b border-dashed border-line pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
              {CATEGORY_META[category].label}
              <span className="ml-2 text-ink-3/70">
                （{section.length} 个 · 拖拽 ⠿ 排序）
              </span>
            </h2>
            {section.length === 0 ? (
              <p className="mb-12 border border-dashed border-line py-8 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
                该目录还没有相册，在下方新建。
              </p>
            ) : (
              <AdminAlbumList
                albums={section.map((a) => ({
                  ...a,
                  count: counts[a.id],
                  coverUrl: thumb(a.coverPath, 120),
                  categoryLabel: CATEGORY_META[category].label,
                }))}
              />
            )}
          </section>
        )
      })}

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
