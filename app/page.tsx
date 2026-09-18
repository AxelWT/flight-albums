import GateHome from '@/components/GateHome'
import { trackVisit } from '@/lib/trackVisit'

/**
 * 首页 = 门厅
 * 居中 wordmark → 「进入」→ 四角小标签，树影光斑缓慢晃动。
 * 点击「进入」跳转到 /lens 相册列表。
 */
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  await trackVisit('/')
  return <GateHome />
}
