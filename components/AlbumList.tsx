/**
 * 相册总入口组件 —— 渲染所有相册的封面卡片网格
 *
 *   <AlbumList albums={albums} counts={counts} />
 *
 * 服务端组件：数据由页面查询后传入，点击跳转 /lens/<id>。
 */
import Link from 'next/link'
import type { Album } from '@/lib/types'
import { thumb } from '@/lib/imageCdn'
import { CATEGORY_META, normalizeCategory } from '@/lib/categories'

interface Props {
  albums: Album[]
  /** 各相册的照片数量，key 为 albumId */
  counts: Record<string, number>
}

export default function AlbumList({ albums, counts }: Props) {
  if (!albums.length) {
    return (
      <p className="my-10 border-t border-b border-dashed border-line py-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        还没有相册。
      </p>
    )
  }

  return (
    <div className="my-8 font-serif text-ink">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6 max-[520px]:grid-cols-1 max-[520px]:gap-4">
        {albums.map((album) => (
          <Link
            key={album.id}
            href={`${CATEGORY_META[normalizeCategory(album.category)].path}/${album.id}`}
            className="group flex flex-col overflow-hidden border border-line-soft bg-bg-soft text-ink no-underline transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-line hover:shadow-card-hover"
          >
            <div className="aspect-[16/10] w-full overflow-hidden">
              <img
                src={thumb(album.coverPath, 600)}
                alt={album.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </div>
            <div className="border-t border-dashed border-line-soft px-5 pt-[18px] pb-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="m-0 font-serif text-[19px] font-normal text-ink">
                  {album.title}
                </h3>
                <span className="flex-none font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
                  {counts[album.id] ?? 0} 张
                </span>
              </div>
              {album.description && (
                <p className="mt-2.5 font-serif text-sm leading-[1.7] text-ink-2">
                  {album.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
