import type { Metadata } from 'next'
import { listAlbums, listPhotosByAlbum } from '@/lib/queries'
import AlbumList from '@/components/AlbumList'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '摄影 — Flight Albums',
  description: '用镜头记录生活中的瞬间',
}

export default async function LensPage() {
  const albums = listAlbums()
  const counts: Record<string, number> = {}
  for (const a of albums) {
    counts[a.id] = listPhotosByAlbum(a.id).length
  }

  return (
    <>
      <h1 className="mb-2 font-serif text-[2rem] font-normal leading-tight tracking-[-0.01em] text-ink">
        摄影
      </h1>
      <blockquote className="my-4 border-l-2 border-line pl-5 font-serif text-[1.02em] italic text-ink-2">
        用镜头记录生活中的瞬间。
      </blockquote>
      <AlbumList albums={albums} counts={counts} />
    </>
  )
}
