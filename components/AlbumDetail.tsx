/**
 * 相册详情（服务端组件）—— 供 /lens/[albumId] 与 /aesthetic/[albumId] 复用
 *
 * 访问控制（lib/albumAccess）：隐藏相册对访客 404；密码相册未解锁时只渲染标题 + 密码表单。
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listPhotosByAlbum } from '@/lib/queries'
import { thumbSrcset } from '@/lib/imageCdn'
import { getAlbumAccess } from '@/lib/albumAccess'
import { CATEGORY_META, normalizeCategory } from '@/lib/categories'
import PhotoGallery from '@/components/PhotoGallery'
import AlbumLock from '@/components/AlbumLock'

export default async function AlbumDetail({ albumId }: { albumId: string }) {
  const access = await getAlbumAccess(albumId)
  if (access.status === 'not-found' || access.status === 'hidden') notFound()
  const album = access.album
  const category = normalizeCategory(album.category)

  // 密码相册未解锁：只显示标题 + 解锁表单，不返回照片数据
  if (access.status === 'locked') {
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
        <AlbumLock albumId={album.id} />
      </>
    )
  }

  const photos = listPhotosByAlbum(albumId)

  // 服务端预生成响应式缩略图签名 URL（240/400/640w），传给客户端 PhotoGallery
  const thumbs: Record<string, { src: string; srcset: string }> = {}
  for (const p of photos) {
    thumbs[p.path] = thumbSrcset(p.path)
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
      <PhotoGallery photos={photos} thumbs={thumbs} />
    </>
  )
}
