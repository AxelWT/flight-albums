import type { Metadata } from 'next'
import { listAlbums, listPhotosByAlbum } from '@/lib/queries'
import { isAdmin } from '@/lib/albumAccess'
import { trackVisit } from '@/lib/trackVisit'
import AlbumList from '@/components/AlbumList'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '拾光 — Flight Albums',
  description: '拾起散落的时光与光影',
}

export default async function LensPage() {
  await trackVisit('/lens')
  const albums = listAlbums('lens', await isAdmin())
  const counts: Record<string, number> = {}
  for (const a of albums) {
    counts[a.id] = listPhotosByAlbum(a.id).length
  }

  return (
    <>
      <h1 className="mb-2 font-serif text-[2rem] font-normal leading-tight tracking-[-0.01em] text-ink">
        拾光
      </h1>
      <blockquote className="my-4 border-l-2 border-line pl-5 font-serif text-[1.02em] italic text-ink-2">
        光影是散落的时光，一张张拾起来，收进相册里。
      </blockquote>
      <AlbumList albums={albums} counts={counts} />
    </>
  )
}
