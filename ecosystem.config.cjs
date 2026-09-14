/**
 * PM2 进程配置
 *
 * 部署后通过 `pm2 start ecosystem.config.cjs` 启动。
 * cwd 自动取本文件所在目录（即部署目录）。
 *
 * 环境变量（ADMIN_PASSWORD / JWT_SECRET / COS_* / DB_PATH）从同目录的 .env 读取
 * （由 start.mjs 注入），不写在此文件中。
 */
module.exports = {
  apps: [
    {
      name: 'flight-albums',
      script: 'start.mjs',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      node_args: '--experimental-sqlite',
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
        PORT: 3000,
      },
    },
  ],
}
