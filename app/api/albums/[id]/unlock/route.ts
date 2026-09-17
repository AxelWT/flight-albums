import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAlbum,
  getAlbumPasswordHash,
  verifyAlbumPassword,
} from '@/lib/queries'
import { isAdmin } from '@/lib/albumAccess'
import {
  signUnlockToken,
  verifyUnlockToken,
  UNLOCK_COOKIE_NAME,
} from '@/lib/auth'

interface Ctx {
  params: Promise<{ id: string }>
}

const UnlockBody = z.object({
  password: z.string().min(1).max(64),
})

/**
 * 公开：访客输入相册密码解锁。
 * 校验 scrypt 哈希，成功后把相册 id 合并进 fa_unlocks cookie（JWT，30 天）。
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const album = getAlbum(id)
  if (!album || album.hidden) {
    return NextResponse.json({ error: '相册不存在' }, { status: 404 })
  }
  if (!album.hasPassword) {
    return NextResponse.json({ error: '该相册无需密码' }, { status: 400 })
  }

  const json = await req.json().catch(() => null)
  const parsed = UnlockBody.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: '请输入密码' }, { status: 400 })
  }

  // 管理员或已解锁：直接成功（幂等）
  if (await isAdmin()) {
    return NextResponse.json({ ok: true })
  }
  const hash = getAlbumPasswordHash(id)
  if (!hash || !verifyAlbumPassword(parsed.data.password, hash)) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 })
  }

  // 合并已有解锁列表，续期 30 天
  const cookieHeader = req.cookies.get(UNLOCK_COOKIE_NAME)?.value
  const existing = await verifyUnlockToken(cookieHeader)
  const albumIds = Array.from(new Set([...existing, id]))
  const token = await signUnlockToken(albumIds)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(UNLOCK_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
