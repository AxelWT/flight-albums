'use client'

/**
 * 摄影画廊组件
 *
 *   <PhotoGallery photos={photos} thumbs={thumbs} />
 *
 * - 缩略图瀑布流：由 Server Component 预生成响应式签名 URL（thumbs），按原始宽高比渲染，
 *   srcset 按设备宽度/DPR 选档下载，省 COS 外网流量
 * - 分批渲染：首批 24 张，滚动到底自动追加（每批 48 张），也可点按钮手动加载；
 *   Lightbox 翻页始终遍历整个相册，不受已加载数量限制
 * - Lightbox：点击时按需调 /api/image/sign 获取大图签名 URL，支持 ←/→/Esc 键盘、
 *   点击背景关闭、左右大点击区翻页、右下角"下载原图"
 * - 风格复用设计令牌：纸感卡片、零圆角、虚线分隔
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Photo } from '@/lib/types'

/** 首批渲染数量 */
const INITIAL_COUNT = 24
/** 每批追加数量 */
const STEP = 48

interface Props {
  photos: Photo[]
  /** 每张照片的响应式缩略图（src + srcset），key 为 photo.path */
  thumbs: Record<string, { src: string; srcset: string }>
}

export default function PhotoGallery({ photos, thumbs }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [largeUrl, setLargeUrl] = useState<string>('')
  const [rawUrl, setRawUrl] = useState<string>('')
  const [visibleCountState, setVisibleCountState] = useState(INITIAL_COUNT)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const active = activeIndex === null ? null : photos[activeIndex] ?? null

  const visibleCount = Math.min(visibleCountState, photos.length)
  const hasMore = visibleCount < photos.length
  const loadMore = useCallback(
    () => setVisibleCountState((n) => Math.min(n + STEP, photos.length)),
    [photos.length]
  )

  /**
   * 按批次切分：首批 INITIAL_COUNT 张、后续每批 STEP 张，各自独立 columns 容器。
   * CSS columns 是整列重排布局，若所有图片放同一容器，追加新批次会重排已有图片
   * （滚动中图片跳列换位）；分块后已渲染的批次内容固定，列宽一致视觉连续。
   */
  const batches: { start: number; items: Photo[] }[] = []
  for (let start = 0; start < visibleCount; ) {
    const size = batches.length === 0 ? INITIAL_COUNT : STEP
    const end = Math.min(start + size, visibleCount)
    batches.push({ start, items: photos.slice(start, end) })
    start = end
  }

  const close = useCallback(() => setActiveIndex(null), [])
  const prev = useCallback(
    () =>
      setActiveIndex((i) =>
        i === null ? i : (i - 1 + photos.length) % photos.length
      ),
    [photos.length]
  )
  const next = useCallback(
    () =>
      setActiveIndex((i) => (i === null ? i : (i + 1) % photos.length)),
    [photos.length]
  )

  // 打开 Lightbox 时，按需获取当前照片的大图 + 原图签名 URL
  useEffect(() => {
    if (!active) {
      setLargeUrl('')
      setRawUrl('')
      return
    }
    let cancelled = false
    setLargeUrl('')
    setRawUrl('')
    fetch('/api/image/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { path: active.path, size: 'large' },
          { path: active.path, size: 'raw' },
        ],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setLargeUrl(data.urls?.[active.path + '::large'] ?? '')
        setRawUrl(data.urls?.[active.path + '::raw'] ?? '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    if (activeIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, close, prev, next])

  // 打开 Lightbox 时锁背景滚动
  useEffect(() => {
    document.body.style.overflow = activeIndex === null ? '' : 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [activeIndex])

  // 滚动到底部哨兵时自动追加下一批
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '600px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadMore])

  if (!photos.length) {
    return (
      <p className="my-10 border-t border-b border-dashed border-line py-10 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        还没有照片。
      </p>
    )
  }

  return (
    <div className="my-8 font-serif text-ink">
      {/* 缩略图瀑布流 —— 按批次独立 columns 块渲染（追加不重排已有图片） */}
      {batches.map((batch, batchIndex) => (
        <div
          key={batchIndex}
          className="columns-[280px] gap-5 max-[720px]:columns-[160px] max-[720px]:gap-3"
        >
          {batch.items.map((photo, j) => {
            const i = batch.start + j
            return (
              <button
                key={photo.id}
                type="button"
                className="group mb-5 flex w-full flex-col overflow-hidden border border-line-soft bg-bg-soft text-left shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-line hover:shadow-card-hover max-[720px]:mb-3"
                style={{ breakInside: 'avoid' }}
                aria-label={`查看 ${photo.title}`}
                onClick={() => setActiveIndex(i)}
              >
                <img
                  src={thumbs[photo.path]?.src ?? ''}
                  srcSet={thumbs[photo.path]?.srcset}
                  sizes="(max-width: 720px) 160px, 320px"
                  alt={photo.title}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full transition-transform duration-400 group-hover:scale-[1.03]"
                />
                <span className="flex items-baseline justify-between gap-3 border-t border-dashed border-line-soft px-3.5 py-3 max-[720px]:px-3 max-[720px]:py-2.5">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] max-[720px]:text-[13px]">
                    {photo.title}
                  </span>
                  <span className="flex-none font-mono text-[10.5px] tracking-[0.06em] text-ink-3">
                    {photo.date ?? ''}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ))}

      {/* 加载更多：滚动自动触发，按钮兜底（弱网/IO 失效时） */}
      {hasMore ? (
        <div className="mt-2 flex flex-col items-center gap-3">
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
          <button
            type="button"
            onClick={loadMore}
            className="border border-line px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-ink-3 transition-colors hover:border-line hover:text-ink"
          >
            加载更多
          </button>
          <p className="m-0 font-mono text-[10.5px] tracking-[0.06em] text-ink-3">
            已显示 {visibleCount} / {photos.length} 张
          </p>
        </div>
      ) : (
        photos.length > INITIAL_COUNT && (
          <p className="mt-2 mb-0 text-center font-mono text-[10.5px] tracking-[0.06em] text-ink-3">
            共 {photos.length} 张
          </p>
        )
      )}

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(10,8,6,0.92)] p-6 backdrop-blur-[4px] max-[720px]:p-3"
          onClick={close}
        >
          {/* 左翻页大点击区 */}
          <button
            type="button"
            aria-label="上一张"
            className="absolute inset-y-0 left-0 flex w-1/4 max-w-[200px] items-center justify-start pl-6 text-[28px] text-[rgba(240,236,228,0.4)] transition-colors hover:text-[rgba(240,236,228,0.9)] max-[720px]:hidden"
            onClick={(e) => {
              e.stopPropagation()
              prev()
            }}
          >
            ←
          </button>

          {/* 大图 + 信息 */}
          <figure
            className="relative flex max-h-full max-w-full flex-col items-center gap-4"
            onClick={close}
          >
            {largeUrl ? (
              <img
                key={active.path}
                src={largeUrl}
                alt={active.title}
                className="max-h-[calc(100vh-160px)] max-w-full object-contain shadow-[0_20px_60px_rgba(0,0,0,0.5)] max-[720px]:max-h-[calc(100vh-200px)]"
              />
            ) : (
              <div className="flex h-40 items-center font-mono text-[11px] uppercase tracking-[0.1em] text-[rgba(240,236,228,0.5)]">
                加载中…
              </div>
            )}
            <figcaption className="flex w-full max-w-[960px] items-end justify-between gap-6 max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[18px] text-[#f0ece4]">{active.title}</p>
                {active.description && (
                  <p className="mt-1.5 font-serif text-sm leading-[1.7] text-[rgba(240,236,228,0.7)]">
                    {active.description}
                  </p>
                )}
                <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-[rgba(240,236,228,0.5)]">
                  <span>{active.date ?? ''}</span>
                  {active.location && (
                    <span className="ml-1">· {active.location}</span>
                  )}
                  <span className="ml-1">
                    · {(activeIndex ?? 0) + 1} / {photos.length}
                  </span>
                </p>
              </div>
              {rawUrl && (
                <a
                  href={rawUrl}
                  download
                  className="inline-flex flex-none items-center gap-1.5 border border-[rgba(240,236,228,0.3)] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[rgba(240,236,228,0.7)] no-underline transition-[color,border-color] hover:border-[rgba(240,236,228,0.6)] hover:text-[#f0ece4]"
                  onClick={(e) => e.stopPropagation()}
                >
                  下载 <span aria-hidden="true">↓</span>
                </a>
              )}
            </figcaption>
          </figure>

          {/* 右翻页大点击区 */}
          <button
            type="button"
            aria-label="下一张"
            className="absolute inset-y-0 right-0 flex w-1/4 max-w-[200px] items-center justify-end pr-6 text-[28px] text-[rgba(240,236,228,0.4)] transition-colors hover:text-[rgba(240,236,228,0.9)] max-[720px]:hidden"
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
          >
            →
          </button>

          {/* 关闭按钮 */}
          <button
            type="button"
            aria-label="关闭"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center text-[28px] leading-none text-[rgba(240,236,228,0.6)] transition-colors hover:text-[#f0ece4]"
            onClick={close}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
