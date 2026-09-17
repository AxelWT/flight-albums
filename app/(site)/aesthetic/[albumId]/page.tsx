import type { Metadata } from 'next'
import { getAlbum } from '@/lib/queries'
import AlbumDetail from '@/components/AlbumDetail'

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

export default async function AestheticAlbumPage({ params }: PageProps) {
  const { albumId } = await params
  return <AlbumDetail albumId={albumId} />
}
