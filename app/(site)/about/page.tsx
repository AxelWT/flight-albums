import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '关于 — Flight Albums',
  description: '关于这个摄影站点',
}

export default function AboutPage() {
  return (
    <>
      <h1 className="mb-6 font-serif text-[2rem] font-normal leading-tight tracking-[-0.01em] text-ink">
        关于
      </h1>
      <div className="font-serif text-[16.5px] leading-[1.85] text-ink">
        <p>
          Flight Albums 是一个个人摄影作品展示站。图片存储在腾讯云 COS，按相册归类整理。
        </p>
        <p className="mt-4">
          这里的每一张照片都是某个瞬间的切片 —— 山川、街拍、人像，光打在世界上的那一刻。
        </p>
        <p className="mt-4 text-ink-2">
          站点首页的门厅取自一种安静的美学：暖纸底色，窗外树影落在纸面上缓缓晃动，居中一行「进入」。
        </p>
      </div>
    </>
  )
}
