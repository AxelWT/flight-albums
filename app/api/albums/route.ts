import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { listAlbums, createAlbum, listPhotosByAlbum } from '@/lib/queries'
import { ALBUM_CATEGORIES } from '@/lib/categories'
import { isAdmin } from '@/lib/albumAccess'
import type { AlbumCategory } from '@/lib/types'

/** 公开：列出相册（可按 ?category= 过滤）+ 各相册照片数；隐藏相册仅管理员可见 */
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') as AlbumCategory | null
  const admin = await isAdmin()
  const albums = listAlbums(
    category && (ALBUM_CATEGORIES as readonly string[]).includes(category) ? category : undefined,
    admin
  )
  const counts: Record<string, number> = {}
  for (const a of albums) {
    counts[a.id] = listPhotosByAlbum(a.id).length
  }
  return NextResponse.json({ albums, counts })
}

const CreateBody = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, '相册 id 只能含小写字母、数字和连字符'),
  title: z.string().min(1).max(60),
  description: z.string().max(300).nullable().optional(),
  coverPath: z.string().min(1),
  category: z.enum(ALBUM_CATEGORIES).optional(),
  sortOrder: z.number().int().optional(),
  hidden: z.boolean().optional(),
  password: z.string().min(1).max(64).nullable().optional(),
})

/** 管理员：创建相册 */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = CreateBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    )
  }
  try {
    const album = createAlbum(parsed.data)
    return NextResponse.json({ album }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '创建失败'
    // 主键冲突
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: '相册 id 已存在' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
