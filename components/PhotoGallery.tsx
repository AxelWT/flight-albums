'use client'

/**
 * 摄影画廊组件
 *
 *   <PhotoGallery photos={photos} thumbs={thumbs} />
 *
 * - 缩略图瀑布流：由 Server Component 预生成响应式签名 URL（thumbs），按原始宽高比渲染，
 *   srcset 按设备宽度/DPR 选档下载，省 COS 外网流量
 * - 布局：JS「最短列优先」分配 + flex 等宽列。每张照片放入当前最矮的列，
 *   消除 CSS columns 平衡时不可分割卡片被推到下一列而留下的整段空白；
 *   已知宽高的图片用 aspect-ratio 占位，加载前不抖动
 * - 缩略图：纯图片卡片（无标题/日期文字），点击打开放大；照片元数据
 *   （标题/说明/日期/地点）只在 Lightbox 大图下展示
 * - 分批加载：首批 24 张，滚动到底自动追加（每批 48 张），也可点按钮手动加载；
 *   最短列优先是在线算法，追加不影响已有照片的列归属，滚动中图片不跳列；
 *   Lightbox 翻页始终遍历整个相册，不受已加载数量限制
 * - Lightbox：点击时按需调 /api/image/sign 获取大图签名 URL，支持 ←/→/Esc 键盘、
 *   点击背景关闭、左右大点击区翻页、右下角"下载原图"
 * - 风格复用设计令牌：纸感卡片、零圆角、虚线分隔
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { Photo } from '@/lib/types'

/** 首批渲染数量 */
const INITIAL_COUNT = 24
/** 每批追加数量 */
const STEP = 48

/** 目标列宽（px）：桌面 / 移动端（≤720px 容器），与原 CSS columns 规格一致 */
const DESKTOP_COLUMN_WIDTH = 280
const MOBILE_COLUMN_WIDTH = 160
const MOBILE_BREAKPOINT = 720
/** 列间距（px）：桌面 gap-5 = 20，移动端 gap-3 = 12 */
const DESKTOP_GAP = 20
const MOBILE_GAP = 12
/** SSR 也会渲染 client 组件，useLayoutEffect 在服务端会告警，降级为 useEffect */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

interface Props {
  photos: Photo[]
  /** 每张照片的响应式缩略图（src + srcset），key 为 photo.path */
  thumbs: Record<string, { src: string; srcset: string }>
}

/** 卡片估高：列宽 × 宽高比（纯图卡片无文字区）；无尺寸数据按 1:1 估 */
function estimateCardHeight(photo: Photo, columnWidth: number): number {
  const ratio = photo.width && photo.height ? photo.height / photo.width : 1
  return columnWidth * ratio
}

/** 最短列优先分配：每张照片放入当前最矮的列，使各列底部尽量齐平 */
function allocateColumns<T extends { photo: Photo }>(
  items: T[],
  columnCount: number,
  columnWidth: number
): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => [] as T[])
  const heights: number[] = new Array(columnCount).fill(0)
  for (const item of items) {
    let shortest = 0
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[shortest]) shortest = i
    }
    columns[shortest].push(item)
    heights[shortest] += estimateCardHeight(item.photo, columnWidth)
  }
  return columns
}

export default function PhotoGallery({ photos, thumbs }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [largeUrl, setLargeUrl] = useState<string>('')
  const [rawUrl, setRawUrl] = useState<string>('')
  const [visibleCountState, setVisibleCountState] = useState(INITIAL_COUNT)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [layout, setLayout] = useState({
    count: 3,
    columnWidth: DESKTOP_COLUMN_WIDTH,
  })
  const active = activeIndex === null ? null : photos[activeIndex] ?? null

  // 按容器宽度动态计算列数与实际列宽（以目标列宽为中心）
  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      const w = el.clientWidth
      if (!w) return
      // 移动端判定用视口宽度，与 CSS max-[720px]（视口断点）对齐，
      // 避免 720-768px 视口窗口内估高所用 gap 与实际渲染 gap 不一致
      const mobile =
        typeof window !== 'undefined' &&
        window.innerWidth <= MOBILE_BREAKPOINT
      const target = mobile ? MOBILE_COLUMN_WIDTH : DESKTOP_COLUMN_WIDTH
      const gap = mobile ? MOBILE_GAP : DESKTOP_GAP
      const count = Math.max(1, Math.floor((w + gap) / (target + gap)))
      const columnWidth = (w - gap * (count - 1)) / count
      // 值未变化时保持原引用：图片加载引起的高度变化也会触发 ResizeObserver，
      // 不加守卫会为每张图多渲染一次
      setLayout((prev) =>
        prev.count === count && Math.abs(prev.columnWidth - columnWidth) < 0.5
          ? prev
          : { count, columnWidth }
      )
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const visibleCount = Math.min(visibleCountState, photos.length)
  const hasMore = visibleCount < photos.length
  const loadMore = useCallback(
    () => setVisibleCountState((n) => Math.min(n + STEP, photos.length)),
    [photos.length]
  )

  /**
   * 全局「最短列优先」分配（不分批）：
   * 最短列优先是在线算法 —— 前 N 张的列分配只取决于前 N 张自身，
   * 追加第 N+1 张不会改变已有照片的归属，因此滚动追加时已有图片
   * 不会跳列换位（React 按 photo.id diff 后纯追加）。
   * 若按批次各自分配，批次交界处会因各批列底参差出现大段垂直空隙。
   */
  const visiblePhotos = photos.slice(0, visibleCount)
  const columns = allocateColumns(
    visiblePhotos.map((photo, index) => ({ photo, index })),
    layout.count,
    layout.columnWidth
  )

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
    <div ref={containerRef} className="my-8 font-serif text-ink">
      {/* 缩略图瀑布流 —— 全局最短列优先分配，单组 flex 等宽列渲染 */}
      <div className="flex items-start gap-5 max-[720px]:gap-3">
        {columns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className="flex w-0 flex-1 flex-col gap-5 max-[720px]:gap-3"
          >
            {column.map(({ photo, index }) => (
              <button
                key={photo.id}
                type="button"
                className="group flex w-full flex-col overflow-hidden border border-line-soft bg-bg-soft text-left shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-line hover:shadow-card-hover"
                aria-label={`查看 ${photo.title}`}
                onClick={() => setActiveIndex(index)}
              >
                <img
                  src={thumbs[photo.path]?.src ?? ''}
                  srcSet={thumbs[photo.path]?.srcset}
                  sizes="(max-width: 480px) 48vw, (max-width: 720px) 32vw, 320px"
                  alt={photo.title}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full transition-transform duration-400 group-hover:scale-[1.03]"
                  style={
                    photo.width && photo.height
                      ? {
                          aspectRatio: `${photo.width} / ${photo.height}`,
                        }
                      : undefined
                  }
                />
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 加载更多：滚动自动触发，按钮兜底（弱网/IO 失效时） */}
      {hasMore ? (
        <div className="mt-5 flex flex-col items-center gap-3 max-[720px]:mt-3">
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
