#!/usr/bin/env node
/**
 * 存量照片尺寸回填脚本
 *
 * 扫描 width / height 为 NULL 的照片，逐张通过 COS 数据万象 imageInfo 接口
 * 获取尺寸并写回数据库。尺寸数据用于画廊瀑布流「最短列优先」排布与
 * aspect-ratio 加载占位。
 *
 * EXIF 方向处理：带 Orientation 5-8 的照片（手机竖拍常见）浏览器渲染时会
 * 旋转显示，此处通过 exif 接口检测方向并交换宽高，保证入库的是「显示尺寸」，
 * 与上传路径 createImageBitmap（默认应用 EXIF）语义一致。
 *
 * 网络策略（防限流，教训：直打图片访问域名曾触发 514 限频 → 403 封禁）：
 * - CI 查询直连 COS 源站域名，不走图片访问域名（自定义/CDN 域名带频次
 *   限制与防盗链，批量运维请求不该走它）
 * - 全局限速 ~10 QPS；限流（429/514）与网关类错误退避重试（3s/10s）
 * - 连续 20 张失败自动熔断中止（疑似限流/封禁时及时收手），重跑续跑
 *
 * 特性：
 * - 幂等：只处理缺失尺寸的行，可重复执行；失败的行保持 NULL，重跑自动重试
 * - 在线安全：WAL 模式 + 逐行短事务，应用运行中可执行，无需停服
 * - 环境变量：进程环境优先（Docker 由 env_file 注入），缺失项从 .env / .env.local 补齐
 *
 * 用法：
 *   npm run db:backfill
 *   # 或
 *   node --experimental-sqlite scripts/backfill-dimensions.mjs
 *
 * Docker（脚本已随镜像打入 /app）：
 *   docker exec flight-albums node --experimental-sqlite backfill-dimensions.mjs
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/* ---- 环境变量加载（进程环境优先，加载逻辑同 start.mjs） ---- */
for (const file of [
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '.env'),
]) {
  if (!fs.existsSync(file)) continue
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

/* ---- COS 配置与 GET 签名（逻辑复刻 lib/cos.ts；脚本是纯 .mjs，无法 import TS 模块） ---- */
const secretId = process.env.COS_SECRET_ID
const secretKey = process.env.COS_SECRET_KEY
const bucket = process.env.COS_BUCKET
const region = process.env.COS_REGION
if (!secretId || !secretKey || !bucket || !region) {
  console.error(
    '✗ 缺少 COS 环境变量（COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION）'
  )
  process.exit(1)
}
// CI 查询一律直连 COS 源站：图片访问域名（自定义/CDN）带频次限制与防盗链，
// 批量回填曾触发 514 限频 → 403 封禁；源站是 CI 服务原生入口，无此类风控
const cosHost = `${bucket}.cos.${region}.myqcloud.com`

const sha1 = (data) =>
  crypto.createHash('sha1').update(data, 'utf8').digest('hex')
const hmacSha1 = (key, data) =>
  crypto.createHmac('sha1', key).update(data, 'utf8').digest('hex')

/** 并发数：与限速配合维持吞吐（单请求 200-300ms RTT，8 并发足以跑满限速窗口） */
const CONCURRENCY = 8
/** 全局请求起始最小间隔（ms）：约 10 QPS，对源站友好 */
const MIN_INTERVAL_MS = 100
/** 单请求超时（ms）：防止网络异常时单个请求挂起 */
const REQUEST_TIMEOUT_MS = 15000
/** 单行最大尝试次数（含首次）：限流/网络错误退避重试 */
const MAX_ATTEMPTS = 3
/** 连续失败熔断阈值：疑似限流/封禁时及时中止，避免加重风控 */
const ABORT_THRESHOLD = 20

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---- 全局限速器：任意两次请求起始间隔 ≥ MIN_INTERVAL_MS（JS 单线程，同步段原子） ---- */
let nextSlot = 0
async function pace() {
  const now = Date.now()
  const wait = nextSlot - now
  nextSlot = Math.max(now, nextSlot + MIN_INTERVAL_MS)
  if (wait > 0) await sleep(wait)
}

/** 可重试状态码：限流（429/514）与网关类瞬时错误 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 514])

/**
 * 带限速/超时/重试的 CI 查询。限流或网络错误按 3s/10s 退避重试，
 * 重试耗尽抛 Error（该行保持 NULL，重跑本脚本续跑）。
 */
async function fetchCi(url) {
  let lastErr
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(attempt === 2 ? 3000 : 10000)
    await pace()
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (RETRYABLE_STATUS.has(res.status)) {
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      return res
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

/** 把 key 编码成 URL 路径（保留 / 分隔符），同 lib/cos.ts */
function encodePath(key) {
  const clean = key.startsWith('/') ? key.slice(1) : key
  return '/' + clean.split('/').map(encodeURIComponent).join('/')
}

/** 生成带 CI 处理参数的查询 URL（CI 参数不参与 COS 签名，规则同 lib/cos.ts getSignedGetUrl） */
function signedCiUrl(key, ciParam) {
  const urlPath = encodePath(key)

  const now = Math.floor(Date.now() / 1000)
  const keyTime = `${now - 60};${now + 600}`
  const formatString = `get\n${urlPath}\n\nhost=${cosHost}\n`
  const signKey = hmacSha1(secretKey, keyTime)
  const stringToSign = `sha1\n${keyTime}\n${sha1(formatString)}\n`
  const auth = new URLSearchParams({
    'q-sign-algorithm': 'sha1',
    'q-ak': secretId,
    'q-sign-time': keyTime,
    'q-key-time': keyTime,
    'q-header-list': 'host',
    'q-url-param-list': '',
    'q-signature': hmacSha1(signKey, stringToSign),
  })
  return `https://${cosHost}${urlPath}?${ciParam}&${auth}`
}

/** 响应错误体摘要（前 120 字符），失败原因可诊断 */
async function errorSnippet(res) {
  const body = (await res.text().catch(() => '')).slice(0, 120)
  return body ? `：${body.replace(/\s+/g, ' ')}` : ''
}

/**
 * 解析 EXIF 响应中的 Orientation（容忍字段直传 / {val} 包裹两种格式），
 * 无有效值返回 0（等同 Orientation 1，不旋转）。
 */
function parseExifOrientation(exif) {
  if (!exif || typeof exif !== 'object') return 0
  const raw = exif.Orientation
  const val = raw && typeof raw === 'object' ? raw.val : raw
  const n = parseInt(String(val ?? ''), 10)
  return Number.isFinite(n) && n >= 1 && n <= 8 ? n : 0
}

/**
 * 获取一张照片的显示尺寸（已应用 EXIF 旋转）：
 * imageInfo 取原始像素尺寸；可能带 EXIF 方向的格式（5-8 需交换宽高，
 * 浏览器渲染时按 EXIF 旋转，画廊 aspect-ratio 需与显示比例一致）。
 * EXIF 获取失败则抛错让该行保持 NULL，重跑重试。
 */
async function fetchDisplayDimensions(key) {
  const res = await fetchCi(signedCiUrl(key, 'imageInfo'))
  if (!res.ok) {
    throw new Error(`imageInfo HTTP ${res.status}${await errorSnippet(res)}`)
  }
  const info = await res.json()
  let width = Number(info?.width)
  let height = Number(info?.height)
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('imageInfo 返回无有效尺寸')
  }

  // 只有支持 EXIF 的格式才可能带旋转方向；PNG/GIF 等直接返回原始尺寸
  const format = String(info?.format ?? '').toUpperCase()
  if (['JPEG', 'JPG', 'WEBP', 'HEIC', 'HEIF', 'AVIF'].includes(format)) {
    const exifRes = await fetchCi(signedCiUrl(key, 'exif'))
    let orientation = 0
    if (exifRes.ok) {
      orientation = parseExifOrientation(await exifRes.json().catch(() => null))
    } else {
      // 图片本身无 EXIF 时 CI 会返回错误（信息含 exif 字样）：
      // 视为无方向信息（Orientation 1）正常入库；其余错误（网络 / 鉴权）
      // 抛出让该行保持 NULL，重跑本脚本重试
      const body = await exifRes.text().catch(() => '')
      if (!/exif/i.test(body)) {
        throw new Error(`exif HTTP ${exifRes.status}：${body.slice(0, 120)}`)
      }
    }
    if (orientation >= 5 && orientation <= 8) {
      ;[width, height] = [height, width]
    }
  }
  return { width, height }
}

/* ---- 主流程 ---- */
// 源码布局：脚本在 scripts/，数据库在项目根 data/；
// Docker 布局：脚本在 /app/，数据库在 /app/data（卷挂载），脚本上级不是项目根
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : fs.existsSync(path.join(__dirname, 'data'))
    ? path.join(__dirname, 'data', 'flight-albums.db')
    : path.join(__dirname, '..', 'data', 'flight-albums.db')

if (!fs.existsSync(dbPath)) {
  console.error(`✗ 数据库不存在：${dbPath}`)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL')
// 应用写入高峰（访问统计）时回填可能出现 SQLITE_BUSY，等待而非立即失败
db.exec('PRAGMA busy_timeout = 5000')

// 旧库可能缺 width/height 列，先补齐（新库由应用建表时自带）
{
  const cols = db.prepare('PRAGMA table_info(photos)').all()
  if (!cols.length) {
    console.error('✗ photos 表不存在，请先启动一次服务完成建库。')
    db.close()
    process.exit(1)
  }
  if (!cols.some((c) => c.name === 'width')) {
    db.exec('ALTER TABLE photos ADD COLUMN width INTEGER')
  }
  if (!cols.some((c) => c.name === 'height')) {
    db.exec('ALTER TABLE photos ADD COLUMN height INTEGER')
  }
}

const rows = db
  .prepare('SELECT id, path FROM photos WHERE width IS NULL OR height IS NULL')
  .all()

if (!rows.length) {
  console.log('✓ 所有照片均已有尺寸数据，无需回填。')
  db.close()
  process.exit(0)
}

console.log(`待回填 ${rows.length} 张，直连 COS 源站（${cosHost}）获取尺寸…`)

const update = db.prepare('UPDATE photos SET width = ?, height = ? WHERE id = ?')
const failed = []
let done = 0
let processed = 0
let cursor = 0
let consecutiveFails = 0
let aborted = false

/**
 * 进度输出：TTY 终端用 \r 原地刷新；非 TTY（docker exec 管道 / 重定向）时
 * \r 无换行效果且 stdout 缓冲，改为每 100 张打一行，避免"看似卡住"。
 */
function reportProgress() {
  processed++
  if (process.stdout.isTTY) {
    process.stdout.write(`\r已处理 ${processed}/${rows.length}`)
  } else if (processed % 100 === 0 || processed === rows.length) {
    console.log(`已处理 ${processed}/${rows.length}`)
  }
}

// 并发工作池：node:sqlite 的 DatabaseSync 是同步 API，JS 单线程下并发安全；
// 连续失败达到熔断阈值时各 worker 在取下一行前退出
async function worker() {
  while (!aborted) {
    const i = cursor++
    if (i >= rows.length) return
    const row = rows[i]
    try {
      const { width, height } = await fetchDisplayDimensions(row.path)
      update.run(width, height, row.id)
      done++
      consecutiveFails = 0
    } catch (err) {
      failed.push({
        path: row.path,
        reason: err instanceof Error ? err.message : String(err),
      })
      if (++consecutiveFails >= ABORT_THRESHOLD) aborted = true
    }
    reportProgress()
  }
}

await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker())
)

process.stdout.write('\n\n')
console.log(`✓ 回填结束：成功 ${done} 张，失败 ${failed.length} 张。`)

if (aborted) {
  console.log(
    `⚠ 连续 ${ABORT_THRESHOLD} 张失败，已熔断中止（疑似源站限流或网络异常）。`
  )
  console.log('  已回填的数据已保留；等几分钟网络恢复后重跑本脚本，将自动续跑。')
}

if (failed.length) {
  console.log('\n失败明细（保持 NULL，重跑本脚本可重试）：')
  for (const f of failed) console.log(`  - ${f.path}：${f.reason}`)
}

db.close()
process.exitCode = failed.length ? 1 : 0
