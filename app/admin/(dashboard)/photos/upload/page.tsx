import Link from 'next/link'
import { listAlbums } from '@/lib/queries'
import PhotoUploader from '@/components/admin/PhotoUploader'

export const dynamic = 'force-dynamic'

export default function UploadPage() {
  const albums = listAlbums(undefined, true)

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="font-serif text-[1.6rem] font-normal text-ink">上传照片</h1>
        <Link
          href="/admin"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 no-underline hover:text-ink"
        >
          ← 仪表盘
        </Link>
      </div>

      <PhotoUploader albums={albums} />
    </>
  )
}
