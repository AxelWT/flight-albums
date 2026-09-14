import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // node:sqlite 是 Node 内置模块，标记为外部包避免被打包
  serverExternalPackages: ['node:sqlite'],
  // 生产环境用 standalone 输出，部署时自带最小 node_modules，无需在服务器装依赖
  output: 'standalone',
}

export default nextConfig
