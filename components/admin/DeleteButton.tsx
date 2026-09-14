'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 通用删除按钮 —— 确认后 DELETE 指定 API 路径，成功后刷新页面数据。
 */
interface Props {
  apiPath: string
  label?: string
  onDeleted?: () => void
}

export default function DeleteButton({
  apiPath,
  label = '删除',
  onDeleted,
}: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handle() {
    if (!confirm('确定删除？此操作不可撤销。')) return
    setDeleting(true)
    const res = await fetch(apiPath, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      if (onDeleted) onDeleted()
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? '删除失败')
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={deleting}
      className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 transition-colors hover:text-terracotta disabled:opacity-50"
    >
      {deleting ? '删除中…' : label}
    </button>
  )
}
