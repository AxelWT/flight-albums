'use client'

/**
 * COS Browser 外链浮动按钮 + 确认弹窗。
 *
 * 固定在右下角，点击弹出小确认框，确认后在新标签打开原网站。
 */
import { useEffect, useState } from 'react'

export default function CosExternalLink({ url }: { url: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-20 flex h-11 w-11 items-center justify-center border border-line bg-bg text-ink-3 shadow-sm transition-colors hover:text-ink"
        title="在新窗口打开原站"
        aria-label="在新窗口打开原站"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[20rem] max-w-[90vw] border border-line bg-bg px-6 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-serif text-[1.05rem] text-ink">在新窗口打开原站？</p>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink-3">
              离开内嵌视图，跳转到腾讯云 COS Browser 官网。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 transition-colors hover:text-ink"
              >
                取消
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="bg-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink no-underline transition-colors hover:bg-accent-hover"
              >
                打开 ↗
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
