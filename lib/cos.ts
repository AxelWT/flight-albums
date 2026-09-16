/**
 * 腾讯云 COS 操作：预签名上传 URL + GET 访问签名 + 对象删除
 *
 * 不依赖 COS SDK，直接用 Node 内置 crypto 实现 COS v5 HMAC-SHA1 签名，
 * 保持依赖最小化。SecretId/SecretKey 仅在服务端使用，绝不暴露给前端。
 *
 * 签名算法参考：https://cloud.tencent.com/document/product/436/7778
 */
import crypto from 'node:crypto'

function sha1(data: string): string {
  return crypto.createHash('sha1').update(data, 'utf8').digest('hex')
}

function hmacSha1(key: string, data: string): string {
  return crypto.createHmac('sha1', key).update(data, 'utf8').digest('hex')
}

interface CosConfig {
  secretId: string
  secretKey: string
  bucket: string
  region: string
  host: string
  /** 图片访问域名（自定义源站 / CDN 加速域名），未配置时用 COS 源站 */
  imageHost?: string
  /** 图片访问域名是否带签名（默认 true；CDN 加速域名须设为 false） */
  imageHostSigned: boolean
}

function getConfig(): CosConfig {
  const secretId = process.env.COS_SECRET_ID
  const secretKey = process.env.COS_SECRET_KEY
  const bucket = process.env.COS_BUCKET
  const region = process.env.COS_REGION
  if (!secretId || !secretKey || !bucket || !region) {
    throw new Error(
      '缺少 COS 环境变量（COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION）'
    )
  }
  // 去掉协议前缀和末尾斜杠，只保留裸域名（签名和 URL 拼接用）
  const imageHost = process.env.COS_IMAGE_HOST
    ?.replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
  return {
    secretId,
    secretKey,
    bucket,
    region,
    host: `${bucket}.cos.${region}.myqcloud.com`,
    imageHost: imageHost || undefined,
    imageHostSigned: process.env.COS_IMAGE_HOST_SIGNED !== 'false',
  }
}

/** 把 key 编码成 URL 路径（保留 / 分隔符） */
function encodePath(key: string): string {
  const clean = key.startsWith('/') ? key.slice(1) : key
  return '/' + clean.split('/').map(encodeURIComponent).join('/')
}

/**
 * 通用签名：生成 COS 请求的 Authorization 头 / query 签名参数。
 * 用于私有读 Bucket 的 GET 访问签名。
 *
 * method: HTTP 方法（get / put / delete / head）
 * urlPath: 已编码的对象路径（如 /lens/mountains/001.jpg）
 * queryParams: 额外的 query 参数（如数据万象的 imageView2），会参与签名
 */
function signRequest(
  method: string,
  urlPath: string,
  queryParams: Record<string, string> = {},
  expireSeconds = 3600,
  hostOverride?: string
): string {
  const { secretId, secretKey, host } = getConfig()

  const now = Math.floor(Date.now() / 1000)
  const start = now - 60
  const end = now + expireSeconds
  const keyTime = `${start};${end}`

  // 参数按字典序排列
  const paramKeys = Object.keys(queryParams).sort()
  const paramStr = paramKeys.map((k) => `${k}=${queryParams[k]}`).join('&')
  const headerStr = `host=${hostOverride ?? host}`

  const formatString = `${method}\n${urlPath}\n${paramStr}\n${headerStr}\n`
  const signKey = hmacSha1(secretKey, keyTime)
  const stringToSign = `sha1\n${keyTime}\n${sha1(formatString)}\n`
  const signature = hmacSha1(signKey, stringToSign)

  const auth = new URLSearchParams({
    'q-sign-algorithm': 'sha1',
    'q-ak': secretId,
    'q-sign-time': keyTime,
    'q-key-time': keyTime,
    'q-header-list': 'host',
    'q-url-param-list': paramKeys.join(';'),
    'q-signature': signature,
  })
  return auth.toString()
}

/**
 * 生成带签名的 GET 访问 URL（私有读 Bucket 访问图片用）。
 *
 * 可携带数据万象（CI）图片处理参数（ciParams），用斜杠格式（如
 * `imageView2/2/w/480/format/webp/q/85`）。这些参数不参与 COS 签名
 * （COS 验签时把它们归到 path 而非 query 参数），只拼到最终 URL 的 query 部分。
 *
 * expireSeconds 内有效（默认 1 小时）。
 */
export function getSignedGetUrl(
  key: string,
  ciParams?: string,
  expireSeconds = 3600
): string {
  const { host, imageHost, imageHostSigned } = getConfig()
  const urlPath = encodePath(key)

  // 配置了图片域名时走它，否则走 COS 源站
  const finalHost = imageHost ?? host

  // CDN 加速域名（imageHostSigned=false）：不带签名。原因有二：
  // 1. COS 预签名 URL 不适用于 CDN 加速域名（回源时 COS 报 InvalidAccessKeyId），
  //    CDN 域名回源鉴权由 COS 控制台配置域名时的服务授权承担
  // 2. 签名含时间戳、每次生成都不同，会让 CDN 缓存完全失效；
  //    不签名则缓存 key 稳定（路径 + CI 参数），命中率最高
  if (imageHost && !imageHostSigned) {
    return ciParams
      ? `https://${finalHost}${urlPath}?${ciParams}`
      : `https://${finalHost}${urlPath}`
  }

  // 带签名：签名 host 必须与实际访问域名一致（COS 按请求的 Host 验签）
  const signQuery = signRequest('get', urlPath, {}, expireSeconds, imageHost)
  // 最终 URL：CI 参数 + 签名参数。CI 参数放前面。
  const query = ciParams ? `${ciParams}&${signQuery}` : signQuery
  return `https://${finalHost}${urlPath}?${query}`
}

/**
 * 生成 COS 预签名 PUT URL，客户端用它直传图片到 COS（图片字节不经服务器）。
 * expireSeconds 内有效（默认 10 分钟）。
 */
export function getPresignedPutUrl(key: string, expireSeconds = 600): string {
  const { host } = getConfig()
  const urlPath = encodePath(key)
  const signQuery = signRequest('put', urlPath, {}, expireSeconds)
  return `https://${host}${urlPath}?${signQuery}`
}

/**
 * 删除 COS 上的对象（管理员删除照片时调用）。
 * 用 Authorization 头签名 DELETE 请求。
 * 返回 true 表示已删除或本就不存在。
 */
export async function deleteObject(key: string): Promise<boolean> {
  const { secretId, secretKey, host } = getConfig()
  const urlPath = encodePath(key)

  const now = Math.floor(Date.now() / 1000)
  const start = now - 60
  const end = now + 300
  const keyTime = `${start};${end}`

  const signKey = hmacSha1(secretKey, keyTime)
  const headerStr = `host=${host}`
  const formatString = `delete\n${urlPath}\n\n${headerStr}\n`
  const stringToSign = `sha1\n${keyTime}\n${sha1(formatString)}\n`
  const signature = hmacSha1(signKey, stringToSign)

  const auth =
    `q-sign-algorithm=sha1&q-ak=${secretId}` +
    `&q-sign-time=${keyTime}&q-key-time=${keyTime}` +
    `&q-header-list=host&q-url-param-list=&q-signature=${signature}`

  const res = await fetch(`https://${host}${urlPath}`, {
    method: 'DELETE',
    headers: { Authorization: auth },
  })

  // 204 = 删除成功，404 = 对象本就不存在
  return res.status === 204 || res.status === 404
}
