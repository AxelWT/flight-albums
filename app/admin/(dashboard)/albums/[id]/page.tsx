import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAlbum, listPhotosByAlbum } from '@/lib/queries'
import AlbumForm from '@/components/admin/AlbumForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AlbumEditPage({ params }: PageProps) {
  const { id } = await params
  const album = getAlbum(id)
  if (!album) notFound()

  const photoCount = listPhotosByAlbum(id).length

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="font-serif text-[1.6rem] font-normal text-ink">
          编辑相册
        </h1>
        <Link
          href="/admin/albums"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline hover:text-ink"
        >
          ← 返回列表
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3 font-mono text-[11px] text-ink-3">
        <span className="uppercase tracking-[0.08em]">id: {album.id}</span>
        <span>·</span>
        <span>{photoCount} 张照片</span>
        <Link
          href={`/admin/photos/${album.id}`}
          className="uppercase tracking-[0.08em] text-ink-3 underline hover:text-ink"
        >
          管理照片 →
        </Link>
      </div>

      <div className="max-w-md">
        <AlbumForm album={album} />
      </div>
    </>
  )
}
