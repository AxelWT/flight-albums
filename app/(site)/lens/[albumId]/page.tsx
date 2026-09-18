import type { Metadata } from 'next'
import { getAlbumAccess } from '@/lib/albumAccess'
import { trackVisit } from '@/lib/trackVisit'
import AlbumDetail from '@/components/AlbumDetail'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ albumId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { albumId } = await params
  const access = await getAlbumAccess(albumId)
  if (access.status === 'not-found' || access.status === 'hidden') {
    return { title: '相册不存在 — Flight Albums' }
  }
  // 锁定状态只暴露标题，不泄露简介
  return {
    title: `${access.album.title} — Flight Albums`,
    description:
      access.status === 'ok' ? (access.album.description ?? undefined) : undefined,
  }
}

export default async function LensAlbumPage({ params }: PageProps) {
  const { albumId } = await params
  // 仅在可正常浏览时计数（锁定/隐藏的尝试访问不进统计，避免刷密码请求污染数据）
  const access = await getAlbumAccess(albumId)
  if (access.status === 'ok') {
    await trackVisit(`/lens/${albumId}`, albumId)
  }
  return <AlbumDetail albumId={albumId} />
}
