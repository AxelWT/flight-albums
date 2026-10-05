import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { reorderAlbums, listAlbums } from '@/lib/queries'
import { ALBUM_CATEGORIES } from '@/lib/categories'

const ReorderBody = z.object({
  category: z.enum(ALBUM_CATEGORIES),
  /** 该分类下全部相册 id 的新顺序（前端拖拽排序后的完整列表） */
  ids: z.array(z.string().min(1)).min(1),
})

/**
 * 管理员：重排某分类的相册顺序（管理页拖拽保存）。
 * ids 必须与该分类现有相册完全一致；只重写该分类的 sortOrder。
 */
export async function PUT(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = ReorderBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    )
  }
  try {
    reorderAlbums(parsed.data.category, parsed.data.ids)
    return NextResponse.json({
      albums: listAlbums(parsed.data.category, true),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '重排失败'
    return NextResponse.json({ error: msg }, { status: 409 })
  }
}
