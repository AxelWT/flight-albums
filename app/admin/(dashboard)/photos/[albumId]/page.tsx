import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAlbum, listPhotosByAlbum } from '@/lib/queries'
import PhotoTable from '@/components/admin/PhotoTable'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ albumId: string }>
}

export default async function PhotosManagePage({ params }: PageProps) {
  const { albumId } = await params
  const album = getAlbum(albumId)
  if (!album) notFound()

  const photos = listPhotosByAlbum(albumId)

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="font-serif text-[1.6rem] font-normal text-ink">
            {album.title}
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
            照片管理 · {photos.length} 张
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href={`/admin/photos/upload`}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline hover:text-ink"
          >
            上传照片
          </Link>
          <Link
            href="/admin/albums"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline hover:text-ink"
          >
            ← 相册列表
          </Link>
        </div>
      </div>

      <PhotoTable photos={photos} albumId={album.id} />
    </>
  )
}
