import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { listPhotosByAlbum, listAllPhotos, createPhoto } from '@/lib/queries'

/** 公开：按相册列出照片（?album=xxx），不带 album 则列出全部（管理用） */
export async function GET(req: NextRequest) {
  const album = req.nextUrl.searchParams.get('album')
  const photos = album ? listPhotosByAlbum(album) : listAllPhotos()
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
