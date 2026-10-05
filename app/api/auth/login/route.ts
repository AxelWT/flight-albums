import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  verifyPassword,
  signToken,
  COOKIE_NAME,
  TOKEN_TTL_SECONDS,
} from '@/lib/auth'

const Body = z.object({ password: z.string().min(1) })

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!verifyPassword(parsed.data.password)) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 })
  }

  const token = await signToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_TTL_SECONDS, // 2 小时（middleware 滑动续期）
  })
  return res
}
