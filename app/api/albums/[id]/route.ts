import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  updateAlbum,
  deleteAlbum,
  getAlbum,
  getAlbumPhotoPaths,
} from '@/lib/queries'
import { deleteObject } from '@/lib/cos'
import { ALBUM_CATEGORIES } from '@/lib/categories'

interface Ctx {
  params: Promise<{ id: string }>
}

const UpdateBody = z.object({
  title: z.string().min(1).max(60).optional(),
  description: z.string().max(300).nullable().optional(),
  coverPath: z.string().min(1).optional(),
  category: z.enum(ALBUM_CATEGORIES).optional(),
  sortOrder: z.number().int().optional(),
  hidden: z.boolean().optional(),
  /** 密码：字符串=设置，null=清除，缺省=不变 */
  password: z.string().min(1).max(64).nullable().optional(),
})

/** 管理员：更新相册 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const json = await req.json().catch(() => null)
  const parsed = UpdateBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    )
  }
  const album = updateAlbum(id, parsed.data)
  if (!album) return NextResponse.json({ error: '相册不存在' }, { status: 404 })
  return NextResponse.json({ album })
}

/** 管理员：删除相册（级联删照片记录，尽力清理 COS 文件） */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!getAlbum(id)) {
    return NextResponse.json({ error: '相册不存在' }, { status: 404 })
  }
  // 先取出照片路径，删记录后尽力删 COS 文件
  const paths = getAlbumPhotoPaths(id)
  const ok = deleteAlbum(id)
  if (!ok) return NextResponse.json({ error: '删除失败' }, { status: 500 })

  // 后台清理 COS（不阻塞响应，失败也无所谓）
  for (const p of paths) {
    deleteObject(p).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
