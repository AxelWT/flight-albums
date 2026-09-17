/**
 * 相册详情（服务端组件）—— 供 /lens/[albumId] 与 /aesthetic/[albumId] 复用
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAlbum, listPhotosByAlbum } from '@/lib/queries'
import { thumb } from '@/lib/imageCdn'
import { CATEGORY_META, normalizeCategory } from '@/lib/categories'
import PhotoGallery from '@/components/PhotoGallery'

export default async function AlbumDetail({ albumId }: { albumId: string }) {
  const album = getAlbum(albumId)
  if (!album) notFound()

  const photos = listPhotosByAlbum(albumId)
  const category = normalizeCategory(album.category)

  // 服务端预生成缩略图签名 URL，传给客户端 PhotoGallery
  const thumbUrls: Record<string, string> = {}
  for (const p of photos) {
    thumbUrls[p.path] = thumb(p.path)
  }

  return (
    <>
      <div className="mb-1">
        <Link
          href={CATEGORY_META[category].path}
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline transition-colors hover:text-ink"
        >
          ← 全部{CATEGORY_META[category].label}相册
        </Link>
      </div>
      <h1 className="mb-2 font-serif text-[2rem] font-normal leading-tight tracking-[-0.01em] text-ink">
        {album.title}
      </h1>
      {album.description && (
        <blockquote className="my-4 border-l-2 border-line pl-5 font-serif text-[1.02em] italic text-ink-2">
          {album.description}
        </blockquote>
      )}
      <PhotoGallery photos={photos} thumbUrls={thumbUrls} />
    </>
  )
}
