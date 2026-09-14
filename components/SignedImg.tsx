'use client'

/**
 * 签名图片组件 —— 客户端自动获取 COS 签名 URL 并渲染。
 *
 * 用于管理后台的 Client Component（AlbumForm 封面预览、PhotoUploader 刚上传预览、
 * PhotoTable 缩略图）。公开画廊页用 Server Component 直接传签名 URL，不走这个。
 *
 *   <SignedImg path="lens/mountains/001.jpg" size="thumb" />
 */
import { useEffect, useState } from 'react'
import { signedUrl } from '@/lib/clientImage'

interface Props {
  path: string
  size?: 'thumb' | 'large' | 'raw'
  alt?: string
  className?: string
}

export default function SignedImg({
  path,
  size = 'thumb',
  alt = '',
  className,
}: Props) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    signedUrl(path, size).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [path, size])

  if (!url) {
    return <div className={className} aria-hidden="true" />
  }
  return <img src={url} alt={alt} className={className} />
}
