/**
 * COS 图片访问诊断脚本
 *
 * 用法：
 *   node --experimental-sqlite scripts/diagnose-cos.mjs
 *
 * 自动从数据库取一张最近上传的照片，用 SecretKey 生成带签名的 URL 并测试访问。
 * 验证签名是否正确、数据万象图片处理是否生效。
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- 加载 .env.local ----
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('✗ 找不到 .env.local，请先创建（cp .env.example .env.local）')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/)
    if (m) {
      const key = m[1].trim()
      const val = m[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
}
loadEnv()

const secretId = process.env.COS_SECRET_ID
const secretKey = process.env.COS_SECRET_KEY
const bucket = process.env.COS_BUCKET
const region = process.env.COS_REGION
const host = `${bucket}.cos.${region}.myqcloud.com`

// ---- 签名工具（与 lib/cos.ts 同逻辑） ----
function sha1(data) {
  return crypto.createHash('sha1').update(data, 'utf8').digest('hex')
}
function hmacSha1(key, data) {
  return crypto.createHmac('sha1', key).update(data, 'utf8').digest('hex')
}
function encodePath(key) {
  const clean = key.startsWith('/') ? key.slice(1) : key
  return '/' + clean.split('/').map(encodeURIComponent).join('/')
}
// ciParams: 数据万象斜杠格式参数（不参与签名），如 'imageView2/2/w/480/format/webp/q/85'
function signGet(key, ciParams) {
  const urlPath = encodePath(key)
  const now = Math.floor(Date.now() / 1000)
  const keyTime = `${now - 60};${now + 3600}`
  const headerStr = `host=${host}`
  // 签名时参数行留空 —— CI 参数不参与签名
  const formatString = `get\n${urlPath}\n\n${headerStr}\n`
  const signKey = hmacSha1(secretKey, keyTime)
  const stringToSign = `sha1\n${keyTime}\n${sha1(formatString)}\n`
  const signature = hmacSha1(signKey, stringToSign)
  const auth = new URLSearchParams({
    'q-sign-algorithm': 'sha1',
    'q-ak': secretId,
    'q-sign-time': keyTime,
    'q-key-time': keyTime,
    'q-header-list': 'host',
    'q-url-param-list': '',
    'q-signature': signature,
  })
  const query = ciParams ? `${ciParams}&${auth.toString()}` : auth.toString()
  return `https://${host}${urlPath}?${query}`
}

// ---- 从数据库取一张照片 ----
const dbPath = process.env.DB_PATH || './data/flight-albums.db'
const db = new DatabaseSync(dbPath)
const photo = db.prepare('SELECT path, title FROM photos ORDER BY createdAt DESC LIMIT 1').get()
const album = db.prepare('SELECT coverPath FROM albums ORDER BY createdAt DESC LIMIT 1').get()
db.close()

const testPath = photo?.path || album?.coverPath
if (!testPath) {
  console.error('✗ 数据库里没有照片记录，请先通过后台上传一张图片。')
  process.exit(1)
}

console.log('═══════════════════════════════════════════════')
console.log('  COS 图片访问诊断（带签名）')
console.log('═══════════════════════════════════════════════')
console.log(`  Bucket:  ${host}`)
console.log(`  测试路径: ${testPath}`)
console.log('═══════════════════════════════════════════════\n')

const urlRaw = signGet(testPath)
const urlThumb = signGet(testPath, 'imageView2/2/w/480/format/webp/q/85')
const urlLarge = signGet(testPath, 'imageView2/2/w/1920/format/webp/q/90')

async function test(label, url) {
  try {
    const res = await fetch(url, { method: 'GET' })
    const ct = res.headers.get('content-type') || ''
    const len = res.headers.get('content-length') || '?'
    let bodySnippet = ''
    if (!res.ok) {
      bodySnippet = (await res.text()).slice(0, 300).replace(/\s+/g, ' ')
    }
    console.log(`【${label}】`)
    console.log(`  状态:   ${res.status} ${res.statusText}`)
    console.log(`  类型:   ${ct}`)
    console.log(`  大小:   ${len} bytes`)
    if (bodySnippet) console.log(`  错误体: ${bodySnippet}`)
    console.log('')
    return res.status
  } catch (e) {
    console.log(`【${label}】`)
    console.log(`  ✗ 网络错误: ${e.message}`)
    console.log('')
    return 0
  }
}

console.log('正在测试...\n')
const rawStatus = await test('原图（带签名）', urlRaw)
const thumbStatus = await test('缩略图（带签名 + imageView2）', urlThumb)
const largeStatus = await test('大图（带签名 + imageView2）', urlLarge)

console.log('═══════════════════════════════════════════════')
console.log('  诊断结论')
console.log('═══════════════════════════════════════════════')

if (rawStatus === 403) {
  console.log(`
  ✗ 带签名原图仍返回 403 —— 签名计算有误，或密钥不正确。
  请检查 .env.local 里的 COS_SECRET_ID / COS_SECRET_KEY 是否正确。
`)
} else if (rawStatus === 200 && (thumbStatus !== 200 || largeStatus !== 200)) {
  console.log(`
  ⚠ 原图正常但缩略图/大图失败 —— 可能是数据万象（CI）未开通。
  开通数据万象（免费）后重试：https://console.cloud.tencent.com/ci
`)
} else if (rawStatus === 200 && thumbStatus === 200 && largeStatus === 200) {
  console.log(`
  ✓ 三种 URL 全部正常。签名 + 图片处理均工作正常。
  刷新相册页面即可看到图片。
`)
} else if (rawStatus === 404) {
  console.log(`
  ✗ 原图返回 404 —— 图片路径不正确，COS 上找不到该对象。
`)
} else {
  console.log(`
  ? 无法确定问题，请把上面的测试结果发出来进一步分析。
`)
}
console.log('═══════════════════════════════════════════════')
