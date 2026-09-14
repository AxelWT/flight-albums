/**
 * 会缓慢晃动的树叶影子 —— 门厅的视觉灵魂
 *
 * 程序化生成远 / 中 / 近三层树影（确定性随机），每簇再拆成两组节奏不同的小组，
 * 所以影子一边移动一边变形，而不是整块平移。
 * 外层只做 transform / opacity（可合成），高斯模糊放在静态内层。
 */
import { buildDapple, LEAF_PATH, type DappleCluster, type DappleLeaf } from '@/lib/dapple'

// 固定种子：服务端与浏览器端生成一致
const clusters = buildDapple(20260913)

function clusterStyle(c: DappleCluster): React.CSSProperties {
  return {
    left: `${c.x}%`,
    top: `${c.y}%`,
    width: `${c.size}px`,
    height: `${c.size}px`,
    marginLeft: `${-c.size / 2}px`,
    marginTop: `${-c.size / 2}px`,
    ['--op' as string]: c.opacity,
    ['--rot' as string]: `${c.rot}deg`,
    ['--dur' as string]: `${c.dur}s`,
    ['--delay' as string]: `${c.delay}s`,
    ['--drift' as string]: `${c.drift}px`,
  } as React.CSSProperties
}

function leafTransform(leaf: DappleLeaf, size: number): string {
  return `translate(${((leaf.xPct / 100) * size).toFixed(1)} ${((leaf.yPct / 100) * size).toFixed(1)}) rotate(${leaf.angle.toFixed(1)}) scale(${leaf.scale.toFixed(3)})`
}

export default function GateDapple() {
  return (
    <div className="gate-dapple" aria-hidden="true">
      {clusters.map((c) => (
        <div key={c.key} className="dap" style={clusterStyle(c)}>
          {/* 模糊放在静态内层：外层只做 transform / opacity，浏览器栅格化一次后直接合成 */}
          <div className="dap-blur" style={{ filter: `blur(${c.blur}px)` }}>
            <svg viewBox={`0 0 ${c.size} ${c.size}`} preserveAspectRatio="none">
              {c.leaves.map((leaf, i) => (
                <g key={i} transform={leafTransform(leaf, c.size)}>
                  <path d={LEAF_PATH} />
                </g>
              ))}
            </svg>
          </div>
        </div>
      ))}
    </div>
  )
}
