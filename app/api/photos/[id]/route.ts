import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { updatePhoto, deletePhoto, getPhoto } from '@/lib/queries'
import { deleteObject } from '@/lib/cos'

interface Ctx {
  params: Promise<{ id: string }>
}

const UpdateBody = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  date: z.string().max(20).nullable().optional(),
  albumId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  location: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

/** 管理员：更新照片 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const numId = Number(id)
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: 'id 格式错误' }, { status: 400 })
  }
  const json = await req.json().catch(() => null)
  const parsed = UpdateBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    )
  }
  const photo = updatePhoto(numId, parsed.data)
  if (!photo) return NextResponse.json({ error: '照片不存在' }, { status: 404 })
  return NextResponse.json({ photo })
}

/** 管理员：删除照片记录 + 删除 COS 上的图片文件 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const numId = Number(id)
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: 'id 格式错误' }, { status: 400 })
  }
  const photo = getPhoto(numId)
  if (!photo) return NextResponse.json({ error: '照片不存在' }, { status: 404 })

  const ok = deletePhoto(numId)
  if (!ok) return NextResponse.json({ error: '删除失败' }, { status: 500 })

  // 尽力删 COS 文件，失败不影响响应
  deleteObject(photo.path).catch(() => {})

  return NextResponse.json({ ok: true })
}
