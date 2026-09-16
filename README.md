# Flight Albums

个人摄影作品展示站。管理员通过后台上传作品到腾讯云 COS，访客按相册浏览图片。首页门厅复刻自 [flight-space](https://github.com/axelwt/flight-space)：暖纸底、窗外树影光斑缓缓晃动、居中一行「进入」。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 15 (App Router, React 19) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 + 设计令牌 CSS 变量 |
| 数据库 | SQLite（Node 内置 `node:sqlite`，零原生依赖） |
| 图床 | 腾讯云 COS（预签名直传，密钥不出服务器） |
| 认证 | 单管理员密码 + JWT（jose），httpOnly cookie |
| 校验 | Zod |
| 部署 | GitHub Actions → 阿里云 ACR → Docker Compose |

## 项目结构

```
flight-albums/
├── app/
│   ├── layout.tsx                 # 根布局（暗色模式初始化脚本）
│   ├── page.tsx                   # 门厅首页
│   ├── (site)/                    # 公开内页（带导航 + 页脚）
│   │   ├── layout.tsx
│   │   ├── lens/page.tsx          # 相册列表
│   │   ├── lens/[albumId]/page.tsx# 单相册画廊（Lightbox）
│   │   └── about/page.tsx
│   ├── admin/
│   │   ├── login/page.tsx         # 管理员登录
│   │   └── (dashboard)/           # 管理后台（JWT 保护）
│   │       ├── layout.tsx         # 侧边栏外壳
│   │       ├── page.tsx           # 仪表盘
│   │       ├── albums/            # 相册 CRUD
│   │       └── photos/            # 照片上传与管理
│   └── api/                       # REST API（auth / albums / photos / upload/presign）
├── components/
│   ├── GateHome.tsx  GateDapple.tsx  ThemeToggle.tsx
│   ├── PhotoGallery.tsx  AlbumList.tsx
│   └── admin/                     # AdminShell / AlbumForm / PhotoUploader / PhotoTable …
├── lib/
│   ├── dapple.ts                  # 树影生成算法（确定性随机）
│   ├── imageCdn.ts                # COS 实时缩略图 URL
│   ├── db.ts                      # node:sqlite 连接 + 自动建表
│   ├── queries.ts                 # 相册 / 照片 CRUD
│   ├── auth.ts                    # JWT 签发 / 验证
│   ├── cos.ts                     # COS 预签名 + 删除（手写 HMAC-SHA1）
│   └── upload.ts                  # 客户端直传工具
├── styles/                        # tokens.css / gate.css / base.css
├── scripts/init-db.mjs            # 数据库初始化 / 种子
├── Dockerfile                     # 多阶段构建（standalone → 运行镜像）
├── docker-compose.prod.yml        # 生产 compose 编排
├── start.mjs                      # 生产启动包装器（加载 .env）
├── ecosystem.config.cjs           # PM2 配置（可选，Docker 部署不使用）
└── .github/workflows/deploy.yml   # 部署工作流（ACR + Docker Compose）
```

## 本地开发

### 环境要求

- Node.js 22+（使用内置 `node:sqlite`，Node 22 需 `--experimental-sqlite` 标志，Node 24+ 无需）

### 安装与启动

```sh
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

### 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```sh
cp .env.example .env.local
```

| 变量 | 说明 | 位置 |
|---|---|---|
| `ADMIN_PASSWORD` | 管理员登录密码 | 仅服务端 |
| `JWT_SECRET` | JWT 签名密钥 | 仅服务端 |
| `COS_SECRET_ID` | 腾讯云 SecretId | 仅服务端 |
| `COS_SECRET_KEY` | 腾讯云 SecretKey | 仅服务端 |
| `COS_BUCKET` | COS Bucket 名 | 仅服务端 |
| `COS_REGION` | COS 地域（如 `ap-shanghai`） | 仅服务端 |
| `COS_IMAGE_HOST` | 图片访问域名（Variable，可选）：腾讯云 COS 自定义域名——源站域名（如 `img.axello.cn`，默认**带签名**，私有读可用）或 CDN 加速域名（如 `img-cdn.axello.cn`，必须配 `COS_IMAGE_HOST_SIGNED=false`：CDN 域名不支持预签名，且回源鉴权由 COS 控制台服务授权承担，无签名 URL 缓存 key 稳定命中率高） | 仅服务端 |
| `DB_PATH` | SQLite 文件路径 | 仅服务端 |
| `SITE_URL` | 站点公开访问 URL | 仅服务端 |

> COS 密钥只在服务端使用，前端永远拿不到。上传时服务端仅生成限时预签名 URL，图片字节直传 COS，不经服务器。

## 腾讯云 COS 配置

1. **建 Bucket**：在 COS 控制台创建 Bucket，权限设为「私有读」或「公共读」均可（预签名 URL 自带访问凭证）。推荐「公共读」以便直接展示缩略图。
2. **获取密钥**：在 [访问管理](https://console.cloud.tencent.com/cam/capi) 创建 API 密钥（SecretId / SecretKey）。
3. **填配置**：把 Bucket、地域、密钥填入 `.env.local`。
4. **图片处理**：COS 的 `?imageView2/2/w/480/format/webp` 参数实时返回指定尺寸 WebP 缩略图，无需预生成。

## 管理后台

1. 访问 `/admin/login`，输入 `ADMIN_PASSWORD` 登录。
2. **相册管理**：创建相册（id / 名称 / 简介 / 封面）、编辑、删除。
3. **上传照片**：选相册 → 拖拽图片（直传 COS）→ 填元数据 → 保存。
4. **照片管理**：编辑照片信息、「设为封面」、删除（同步删 COS 文件）。

## 图片加载策略

| 场景 | URL 参数 | 体积 |
|---|---|---|
| 画廊缩略图 | `?imageView2/2/w/480/format/webp/q/85` | ~40KB |
| Lightbox 大图 | `?imageView2/2/w/1920/format/webp/q/90` | ~400KB |
| 原图下载 | 无参数 | 原始 |

缩略图网格 `loading="lazy"`，首屏只加载可见区域；点击才加载大图。Lightbox 支持 `←/→` 翻页、`Esc` 关闭、点击背景关闭、右下角「原图」链接。

## 部署

部署通过 GitHub Actions 自动完成：推送到 `main` 分支 → 构建 Docker 镜像 → 推送阿里云 ACR → SSH 到服务器 `docker compose pull && up`。

### 1. 服务器准备

- Docker Engine + Docker Compose v2
- 创建部署目录，如 `/app/flight-albums`

### 2. 阿里云 ACR

在 [阿里云容器镜像服务](https://cr.console.aliyun.com/) 创建个人版/企业版实例，新建命名空间。记录：

- Registry 地址（如 `registry.cn-shanghai.aliyuncs.com`）
- 命名空间（如 `axello`）
- 账号密码

### 3. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 添加：

| Secret | 说明 |
|---|---|
| `ACR_REGISTRY` | ACR Registry 地址 |
| `ACR_NAMESPACE` | ACR 命名空间 |
| `ACR_USERNAME` | ACR 用户名 |
| `ACR_PASSWORD` | ACR 密码 |
| `DEPLOY_HOST` | 服务器 IP |
| `DEPLOY_USER` | SSH 用户 |
| `DEPLOY_SSH_KEY` | SSH 私钥（完整内容） |
| `DEPLOY_PORT` | SSH 端口（可选，默认 22） |
| `DEPLOY_PATH` | 部署目录（如 `/app/flight-albums`） |
| `ADMIN_PASSWORD` | 管理员密码 |
| `JWT_SECRET` | JWT 密钥 |
| `COS_SECRET_ID` / `COS_SECRET_KEY` | 腾讯云密钥 |
| `COS_BUCKET` / `COS_REGION` | COS 配置 |
| `COS_BROWSER_URL` | COS Browser Web 地址（嵌入管理后台 iframe） |
| `SITE_URL` | 站点公开 URL |

Variable（非敏感配置，**Settings → Secrets and variables → Actions → Variables**）：

| Variable | 说明 |
|---|---|
| `COS_IMAGE_HOST` | 图片访问域名（可选）：自定义源站域名（如 `img.axello.cn`，默认带签名）或 CDN 加速域名（如 `img-cdn.axello.cn`，需配 `COS_IMAGE_HOST_SIGNED=false`）。留空走 COS 源站 |
| `COS_IMAGE_HOST_SIGNED` | 图片域名是否带签名（可选，默认 `true`）。配 CDN 加速域名时设 `false` |

### 4. 推送部署

```sh
git push origin main
```

工作流会：构建镜像 → 推送 ACR（`latest` + commit 短哈希）→ SSH 拉取最新镜像 → `docker compose up -d`。

### 5. 反向代理（可选）

用 Nginx 反代到 `localhost:3000`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 数据库

- SQLite 文件由 `node:sqlite` 管理，首次启动自动建表。
- 可选初始化脚本：`node --experimental-sqlite scripts/init-db.mjs`（建表）/ `--seed`（建表 + 示例相册）。
- 删除相册时级联删除其下照片记录，并尽力清理 COS 文件。

## 主题与首页

设计令牌在 `styles/tokens.css`（`--fs-*` 变量），映射到 Tailwind 主题色（`bg-bg` / `text-ink` / `border-line` 等）。改配色只需改 tokens.css。门厅样式在 `styles/gate.css`，树影算法在 `lib/dapple.ts`。深浅色通过 `html.dark` 类切换，持久化到 `localStorage('fa-theme')`。
