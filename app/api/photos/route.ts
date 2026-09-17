import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  listPhotosByAlbum,
  listAllPhotos,
  createPhoto,
  listAlbums,
} from '@/lib/queries'
import { getAlbumAccess, isAdmin, getUnlockedAlbumIds } from '@/lib/albumAccess'

/** 公开：按相册列出照片（?album=xxx）；隐藏/未解锁相册对访客拦截。不带 album 则列出全部（管理用）。 */
export async function GET(req: NextRequest) {
  const album = req.nextUrl.searchParams.get('album')
  if (album) {
    const access = await getAlbumAccess(album)
    if (access.status === 'not-found' || access.status === 'hidden') {
      return NextResponse.json({ photos: [] })
    }
    if (access.status === 'locked') {
      return NextResponse.json({ error: '相册已加密' }, { status: 403 })
    }
    return NextResponse.json({ photos: listPhotosByAlbum(album) })
  }

  const photos = listAllPhotos()
  // 全量列表：访客过滤隐藏 / 未解锁相册的照片
  if (!(await isAdmin())) {
    const unlocked = new Set(await getUnlockedAlbumIds())
    const blocked = new Set(
      listAlbums(undefined, true)
        .filter((a) => a.hidden || (a.hasPassword && !unlocked.has(a.id)))
        .map((a) => a.id)
    )
    return NextResponse.json({
      photos: photos.filter((p) => !blocked.has(p.albumId)),
    })
  }
  return NextResponse.json({ photos })
}

const CreateBody = z.object({
  path: z.string().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  date: z.string().max(20).nullable().optional(),
  albumId: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'albumId 格式错误'),
  location: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

/** 管理员：创建照片记录 */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = CreateBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    )
  }
  const photo = createPhoto(parsed.data)
  return NextResponse.json({ photo }, { status: 201 })
}
