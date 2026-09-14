import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAlbum, listPhotosByAlbum } from '@/lib/queries'
import { thumb } from '@/lib/imageCdn'
import PhotoGallery from '@/components/PhotoGallery'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ albumId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { albumId } = await params
  const album = getAlbum(albumId)
  if (!album) return { title: '相册不存在 — Flight Albums' }
  return {
    title: `${album.title} — Flight Albums`,
    description: album.description ?? undefined,
  }
}

export default async function AlbumPage({ params }: PageProps) {
  const { albumId } = await params
  const album = getAlbum(albumId)
  if (!album) notFound()

  const photos = listPhotosByAlbum(albumId)

  // 服务端预生成缩略图签名 URL，传给客户端 PhotoGallery
  const thumbUrls: Record<string, string> = {}
  for (const p of photos) {
    thumbUrls[p.path] = thumb(p.path)
  }

  return (
    <>
      <div className="mb-1">
        <Link
          href="/lens"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline transition-colors hover:text-ink"
        >
          ← 全部相册
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
