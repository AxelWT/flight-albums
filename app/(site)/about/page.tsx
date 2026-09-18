import type { Metadata } from 'next'
import Link from 'next/link'
import { trackVisit } from '@/lib/trackVisit'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '关于 — Flight Albums',
  description: '关于我 — 一个喜欢拍照、运动、看闲书的人',
}

const sectionLabel =
  'font-mono text-[15px] uppercase tracking-[0.14em] text-ink-3'

export default async function AboutPage() {
  await trackVisit('/about')
  return (
    <>
      {/* 头部：头像 + 名字 + 标语 */}
      <div className="mb-10 flex flex-wrap items-center gap-5">
        <img
          src="/images/felix.jpg"
          alt="Felix"
          className="h-[112px] w-[112px] object-cover shadow-card"
        />
        <div>
          <h1 className="m-0 border-none p-0 font-serif text-[2rem] font-normal leading-tight tracking-[-0.01em] text-ink">
            王腾飞
          </h1>
          <p className="mt-1.5 font-serif text-[15px] text-ink-2">
            一个喜欢拍照、运动、看闲书的人
          </p>
        </div>
      </div>

      <div className="font-serif text-[16.5px] leading-[1.85] text-ink">
        {/* 摄影：本站主题，展开写 */}
        <h2 className={sectionLabel}>摄影</h2>
        <p>
          喜欢扫街、拍风景，技术还在入门阶段，但每次拍到喜欢的照片都会开心一整天。
          这里就是把那些瞬间收起来的地方——按相册归类，配上一点当时的感受，像一本可以翻回去的视觉日记。
        </p>
        <p className="mt-4">
          正在慢慢学习，怎么把看到的世界更好地装进取景框里。
        </p>
        <p className="mt-4 text-ink-2">
          如果某张照片恰好让你停下看了几秒，那我会很开心。
        </p>
      </div>

      {/* 联系方式 */}
      <h2 className={`${sectionLabel} mt-12`}>联系方式</h2>
      <div className="mt-3 flex flex-wrap gap-3 font-serif">
        <Link
          href="mailto:axelwt@163.com"
          className="group inline-flex items-center gap-2 border border-line-soft bg-bg-soft px-4 py-2.5 text-[14px] text-ink no-underline transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-card-hover"
        >
          <svg className="h-[18px] w-[18px] flex-none text-ink-3 transition-colors group-hover:text-ink" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
          <span className="font-medium text-ink-2">Email</span>
          <span className="text-ink">axelwt@163.com</span>
        </Link>
      </div>
    </>
  )
}
