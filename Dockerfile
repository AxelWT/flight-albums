# ===== Stage 1: build =====
FROM node:22-alpine AS build
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ===== Stage 2: runtime =====
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# standalone 输出已自带 server.js + 最小 node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# public/ 静态资源（视频等）不会被打进 standalone 产物，需单独复制
COPY --from=build /app/public ./public
# start.mjs 从构建上下文复制（不在 next build 产物中）
COPY start.mjs ./start.mjs

RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /app/data \
 && chown -R app:app /app

USER app

EXPOSE 3000

CMD ["node", "--experimental-sqlite", "start.mjs"]
