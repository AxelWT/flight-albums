import type { Metadata } from 'next'
import { listAlbums, listPhotosByAlbum } from '@/lib/queries'
import AlbumList from '@/components/AlbumList'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '审美 — Flight Albums',
  description: '收集分散在各处的美',
}

export default async function AestheticPage() {
  const albums = listAlbums('aesthetic')
  const counts: Record<string, number> = {}
  for (const a of albums) {
    counts[a.id] = listPhotosByAlbum(a.id).length
  }

  return (
    <>
      <h1 className="mb-2 font-serif text-[2rem] font-normal leading-tight tracking-[-0.01em] text-ink">
        审美
      </h1>
      <blockquote className="my-4 border-l-2 border-line pl-5 font-serif text-[1.02em] italic text-ink-2">
        美是分散在各处的碎片，收集它们。
      </blockquote>
      <AlbumList albums={albums} counts={counts} />
    </>
  )
}
